import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  parseCSVBankData,
  generateUploadBatchId,
  extractPaymentIndexFromAmount,
  calculateMatchConfidence,
  parseDescription,
  findBestNameMatch,
  calculateDateDifference,
  categorizeTransaction
} from '@/lib/bank-mutation-utils'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const hintYearStr = formData.get('hintYear') as string | null
    const forceMonthStr = formData.get('forceMonth') as string | null
    const deleteExistingStr = formData.get('deleteExisting') as string | null
    const hintYear = hintYearStr ? parseInt(hintYearStr, 10) : undefined
    const forceMonth = forceMonthStr ? parseInt(forceMonthStr, 10) : undefined
    const deleteExisting = deleteExistingStr === 'true'
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type (CSV only)
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
    if (fileExtension !== '.csv') {
      return NextResponse.json({ 
        error: 'Invalid file type. Please upload CSV files only.' 
      }, { status: 400 })
    }

    // Read file content
    const csvContent: string = await file.text()

    // Parse CSV data with hints for date parsing
    const { transactions, verificationHistory, errors: parseErrors } = parseCSVBankData(csvContent, {
      hintYear,
      forceMonth
    })
    
    if (transactions.length === 0) {
      return NextResponse.json({ 
        error: 'No valid transactions found in the file',
        details: parseErrors 
      }, { status: 400 })
    }

    // Delete existing data for the period if requested
    if (deleteExisting && hintYear && forceMonth) {
      try {
        const deleteResult = await (db as any).bankMutation.deleteMany({
          where: {
            AND: [
              {
                transaction_date: {
                  gte: new Date(hintYear, forceMonth - 1, 1),
                  lt: new Date(hintYear, forceMonth, 1)
                }
              }
            ]
          }
        })
        console.log(`Deleted ${deleteResult.count} existing transactions for ${forceMonth}/${hintYear}`)
      } catch (error) {
        console.error('Failed to delete existing data:', error)
        // Continue with upload even if delete fails
      }
    }

    // Generate batch ID
    const batchId = generateUploadBatchId()
    
    // Get residents with payment indices for matching
    const residents = await db.resident.findMany({
      where: { is_active: true },
      select: {
        id: true,
        name: true,
        payment_index: true,
        rt: true,
        rw: true,
        blok: true,
        house_number: true
      }
    }) as any[]

    // Create lookup maps
    const paymentIndexMap = new Map<number, string>()
    const residentNameMap: { id: string; name: string; aliases?: string[] }[] = []
    
    residents.forEach(resident => {
      if (resident.payment_index) {
        paymentIndexMap.set(resident.payment_index, resident.id)
      }
      
      residentNameMap.push({
        id: resident.id,
        name: resident.name,
        aliases: [] // Will be loaded separately to avoid TypeScript issues
      })
    })

    // Process transactions and attempt matching
    const processedTransactions: any[] = []
    let autoMatchedCount = 0
    let needsReviewCount = 0
    
    // Performance logging
    const performanceMetrics = {
      totalTransactions: transactions.length,
      dbInsertTime: 0,
      paymentQueryTime: 0,
      aliasUpdateTime: 0,
      matchingTime: 0,
      startTime: Date.now()
    }
    
    console.log(`[PERFORMANCE] Starting processing of ${transactions.length} transactions`)

    // Prepare bulk insert data
    const bankMutationsToInsert: any[] = []
    const bankVerificationsToInsert: any[] = []
    const aliasesToUpdate: Map<string, any[]> = new Map() // resident_id -> aliases to update

    for (const transaction of transactions) {
      try {
        // Skip transactions with null or invalid amounts
        if (transaction.amount === null || transaction.amount === undefined || isNaN(transaction.amount)) {
          parseErrors.push(`Skipping transaction with invalid amount: ${transaction.description}`)
          continue
        }
        
        // Categorize transaction with transaction_type
        const categorization = categorizeTransaction(transaction.description, transaction.transaction_type)
        
        // Skip transactions without a valid transaction type
        if (!transaction.transaction_type) {
          parseErrors.push(`Skipping transaction without valid type: ${transaction.description}`)
          continue
        }
        
        const transaction_date = new Date(transaction.date)
        
        // Extract payment index from amount
        const payment_index = extractPaymentIndexFromAmount(transaction.amount)
        
        // Parse description
        const descriptionData = parseDescription(transaction.description)
        
        // Attempt matching
        let matched_resident_id: string | null = null
        let matched_payment_id: string | null = null
        let match_score = 0
        let matching_strategy = 'NONE'
        
        // Strategy 1: Payment Index Match (highest priority)
        if (payment_index && paymentIndexMap.has(payment_index)) {
          matched_resident_id = paymentIndexMap.get(payment_index)!
          matching_strategy = 'PAYMENT_INDEX'
          match_score = 0.9
          
          // Try to find matching payment in recent dates
          const paymentQueryStart = Date.now()
          const matchingPayment = await db.payment.findFirst({
            where: {
              resident_id: matched_resident_id,
              amount: transaction.amount,
              payment_date: {
                gte: new Date(transaction_date.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days before
                lte: new Date(transaction_date.getTime() + 7 * 24 * 60 * 60 * 1000)  // 7 days after
              }
            },
            orderBy: { payment_date: 'desc' }
          })
          performanceMetrics.paymentQueryTime += Date.now() - paymentQueryStart
          
          if (matchingPayment) {
            matched_payment_id = matchingPayment.id
            match_score = 0.95
          }
        }
        
        // Strategy 2: Name Fuzzy Matching (if no payment index match)
        if (!matched_resident_id && descriptionData.names.length > 0) {
          for (const name of descriptionData.names) {
            const nameMatch = findBestNameMatch(name, residentNameMap)
            if (nameMatch && nameMatch.similarity > 0.7) {
              matched_resident_id = nameMatch.resident_id
              matching_strategy = 'NAME_MATCH'
              match_score = nameMatch.similarity * 0.6 // Lower confidence for name-only matches
              break
            }
          }
        }
        
        // Determine if auto-matched or needs review
        const isAutoMatched = match_score >= 0.8
        // We no longer auto-verify on upload; mark for review instead
        if (match_score > 0) {
          needsReviewCount++
        } else {
          needsReviewCount++
        }
        
        // Generate a temporary ID for the mutation (will be replaced after insertion)
        const tempMutationId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        
        // Prepare bank mutation data for bulk insert
        bankMutationsToInsert.push({
          id: tempMutationId, // Will be replaced with actual ID after insertion
          transaction_date,
          description: transaction.description,
          amount: transaction.amount,
          balance: transaction.balance,
          reference_number: transaction.reference,
          transaction_type: transaction.transaction_type,
          category: categorization.category,
          is_omitted: categorization.shouldOmit,
          omit_reason: categorization.omit_reason,
          matched_resident_id,
          matched_payment_id,
          match_score,
          matching_strategy,
          raw_data: JSON.stringify(transaction),
          upload_batch: batchId,
          file_name: file.name,
          is_verified: false
        })

        // Prepare verification data for bulk insert
        bankVerificationsToInsert.push({
          mutation_id: tempMutationId, // Will be updated with actual ID after insertion
          action: match_score > 0 ? 'AUTO_MATCH' : 'SYSTEM_UNMATCH',
          confidence: match_score,
          verified_by: 'SYSTEM',
          notes: `Initial match using ${matching_strategy} strategy`
        })

        // Collect bank aliases for bulk update
        if (matched_resident_id && matching_strategy === 'NAME_MATCH') {
          for (const name of descriptionData.names) {
            const nameMatch = findBestNameMatch(name, residentNameMap)
            if (nameMatch && nameMatch.resident_id === matched_resident_id) {
              if (!aliasesToUpdate.has(matched_resident_id)) {
                aliasesToUpdate.set(matched_resident_id, [])
              }
              aliasesToUpdate.get(matched_resident_id)!.push({
                bank_name: name,
                is_verified: isAutoMatched
              })
            }
          }
        }

        processedTransactions.push({
          id: tempMutationId, // Use temporary ID for now
          ...transaction,
          matched_resident_id,
          match_score,
          matching_strategy,
          isAutoMatched
        })

      } catch (error) {
        console.error('Error processing transaction:', error)
        parseErrors.push(`Failed to process transaction: ${transaction.description}`)
      }
    }
    
    // Perform bulk database operations
    const dbInsertStart = Date.now()
    let insertedMutations: any[] = []
    
    if (bankMutationsToInsert.length > 0) {
      console.log(`[BULK_INSERT] Inserting ${bankMutationsToInsert.length} bank mutations...`)
      
      // Remove temporary IDs and let Prisma generate them
      const mutationsToInsert = bankMutationsToInsert.map(({ id, ...rest }) => rest)
      
      // Bulk insert bank mutations
      insertedMutations = await (db as any).bankMutation.createMany({
        data: mutationsToInsert
      })
      
      // Get the inserted mutations with their actual IDs
      const insertedMutationRecords = await (db as any).bankMutation.findMany({
        where: {
          upload_batch: batchId
        },
        orderBy: {
          created_at: 'desc'
        },
        take: bankMutationsToInsert.length
      })
      
      // Update verification records with actual mutation IDs
      const verificationsToInsert = insertedMutationRecords.map((mutation: any, index: number) => ({
        mutation_id: mutation.id,
        action: bankVerificationsToInsert[index].action,
        confidence: bankVerificationsToInsert[index].confidence,
        verified_by: bankVerificationsToInsert[index].verified_by,
        notes: bankVerificationsToInsert[index].notes
      }))
      
      // Bulk insert verifications
      if (verificationsToInsert.length > 0) {
        await (db as any).bankMutationVerification.createMany({
          data: verificationsToInsert
        })
      }
      
      // Update processed transactions with actual IDs
      insertedMutationRecords.forEach((mutation: any, index: number) => {
        const processedIndex = processedTransactions.findIndex(
          t => t.id === bankMutationsToInsert[index].id
        )
        if (processedIndex !== -1) {
          processedTransactions[processedIndex].id = mutation.id
        }
      })
      
      console.log(`[BULK_INSERT] Successfully inserted ${insertedMutationRecords.length} mutations and ${verificationsToInsert.length} verifications`)
    }
    
    // Bulk update aliases
    if (aliasesToUpdate.size > 0) {
      console.log(`[BULK_INSERT] Updating ${aliasesToUpdate.size} resident aliases...`)
      const aliasUpdateStart = Date.now()
      
      for (const [resident_id, aliases] of aliasesToUpdate.entries()) {
        for (const alias of aliases) {
          await (db as any).residentBankAlias.upsert({
            where: {
              residentId_bankName: {
                resident_id,
                bank_name: alias.bank_name
              }
            },
            update: {
              frequency: { increment: 1 },
              last_seen: new Date(),
              is_verified: alias.is_verified
            },
            create: {
              resident_id,
              bank_name: alias.bank_name,
              frequency: 1,
              is_verified: alias.is_verified
            }
          })
        }
      }
      
      performanceMetrics.aliasUpdateTime += Date.now() - aliasUpdateStart
      console.log(`[BULK_INSERT] Alias updates completed`)
    }
    
    performanceMetrics.dbInsertTime += Date.now() - dbInsertStart
    
    // Log performance metrics
    const totalTime = Date.now() - performanceMetrics.startTime
    console.log(`[PERFORMANCE] Processing completed:
      Total transactions: ${performanceMetrics.totalTransactions}
      Total time: ${totalTime}ms
      DB insert time: ${performanceMetrics.dbInsertTime}ms (${((performanceMetrics.dbInsertTime/totalTime)*100).toFixed(1)}%)
      Payment query time: ${performanceMetrics.paymentQueryTime}ms (${((performanceMetrics.paymentQueryTime/totalTime)*100).toFixed(1)}%)
      Alias update time: ${performanceMetrics.aliasUpdateTime}ms (${((performanceMetrics.aliasUpdateTime/totalTime)*100).toFixed(1)}%)
      Average time per transaction: ${(totalTime/performanceMetrics.totalTransactions).toFixed(2)}ms
    `)

    // Process verification history if available
    let importedHistoryCount = 0
    if (verificationHistory.length > 0) {
      try {
        for (const historyItem of verificationHistory) {
          // Find matching resident by house number
          const houseMatch = historyItem.manualVerification.noRumah
          const resident = residents.find(r => 
            r.blok && r.house_number && 
            `${r.blok} / ${r.house_number}` === houseMatch
          )
          
          if (resident) {
            // Create a bank mutation for historical data
            const historicalMutation = await (db as any).bankMutation.create({
              data: {
                transaction_date: new Date(historyItem.originalTransaction.date),
                description: historyItem.originalTransaction.description,
                amount: historyItem.originalTransaction.amount,
                balance: historyItem.originalTransaction.balance,
                transaction_type: historyItem.originalTransaction.transaction_type,
                matched_resident_id: resident.id,
                match_score: 1.0,
                matching_strategy: 'HISTORICAL_IMPORT',
                raw_data: JSON.stringify(historyItem),
                upload_batch: `HISTORICAL_${batchId}`,
                file_name: `historical_${file.name}`,
                is_verified: true,
                verified_at: new Date(),
                verified_by: 'HISTORICAL_IMPORT'
              }
            })
            
            // Store verification history for learning
            await (db as any).bankMutationVerification.create({
              data: {
                mutation_id: historicalMutation.id,
                action: 'MANUAL_CONFIRM',
                confidence: 1.0,
                verified_by: 'HISTORICAL_IMPORT',
                notes: `Historical verification: ${houseMatch} - ${historyItem.manualVerification.bulan}/${historyItem.manualVerification.tahun}`
              }
            })
            
            // Update or create bank alias from historical data
            if (historyItem.originalTransaction.description) {
              const descriptionData = parseDescription(historyItem.originalTransaction.description)
              for (const name of descriptionData.names) {
                if (name.length > 2) {
                  await (db as any).residentBankAlias.upsert({
                    where: {
                      residentId_bankName: {
                        resident_id: resident.id,
                        bank_name: name
                      }
                    },
                    update: {
                      frequency: { increment: 1 },
                      last_seen: new Date(),
                      is_verified: true
                    },
                    create: {
                      resident_id: resident.id,
                      bank_name: name,
                      frequency: 1,
                      is_verified: true
                    }
                  })
                }
              }
            }
            
            importedHistoryCount++
          }
        }
      } catch (error) {
        console.error('Error processing verification history:', error)
        parseErrors.push('Some verification history could not be imported')
      }
    }

    return NextResponse.json({
      batchId,
      totalTransactions: transactions.length,
      validTransactions: processedTransactions.length,
      autoMatched: autoMatchedCount,
      needsReview: needsReviewCount,
      importedHistory: importedHistoryCount,
      errors: parseErrors
    })

  } catch (error) {
    console.error('Error processing bank mutation upload:', error)
    return NextResponse.json({ 
      error: 'Failed to process file upload',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
