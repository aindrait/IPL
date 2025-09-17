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
                transactionDate: {
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
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        paymentIndex: true,
        rt: true,
        rw: true,
        blok: true,
        houseNumber: true
      }
    }) as any[]

    // Create lookup maps
    const paymentIndexMap = new Map<number, string>()
    const residentNameMap: { id: string; name: string; aliases?: string[] }[] = []
    
    residents.forEach(resident => {
      if (resident.paymentIndex) {
        paymentIndexMap.set(resident.paymentIndex, resident.id)
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
    const aliasesToUpdate: Map<string, any[]> = new Map() // residentId -> aliases to update

    for (const transaction of transactions) {
      try {
        // Skip transactions with null or invalid amounts
        if (transaction.amount === null || transaction.amount === undefined || isNaN(transaction.amount)) {
          parseErrors.push(`Skipping transaction with invalid amount: ${transaction.description}`)
          continue
        }
        
        // Categorize transaction with transactionType
        const categorization = categorizeTransaction(transaction.description, transaction.transactionType)
        
        // Skip transactions without a valid transaction type
        if (!transaction.transactionType) {
          parseErrors.push(`Skipping transaction without valid type: ${transaction.description}`)
          continue
        }
        
        const transactionDate = new Date(transaction.date)
        
        // Extract payment index from amount
        const paymentIndex = extractPaymentIndexFromAmount(transaction.amount)
        
        // Parse description
        const descriptionData = parseDescription(transaction.description)
        
        // Attempt matching
        let matchedResidentId: string | null = null
        let matchedPaymentId: string | null = null
        let matchScore = 0
        let matchingStrategy = 'NONE'
        
        // Strategy 1: Payment Index Match (highest priority)
        if (paymentIndex && paymentIndexMap.has(paymentIndex)) {
          matchedResidentId = paymentIndexMap.get(paymentIndex)!
          matchingStrategy = 'PAYMENT_INDEX'
          matchScore = 0.9
          
          // Try to find matching payment in recent dates
          const paymentQueryStart = Date.now()
          const matchingPayment = await db.payment.findFirst({
            where: {
              residentId: matchedResidentId,
              amount: transaction.amount,
              paymentDate: {
                gte: new Date(transactionDate.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days before
                lte: new Date(transactionDate.getTime() + 7 * 24 * 60 * 60 * 1000)  // 7 days after
              }
            },
            orderBy: { paymentDate: 'desc' }
          })
          performanceMetrics.paymentQueryTime += Date.now() - paymentQueryStart
          
          if (matchingPayment) {
            matchedPaymentId = matchingPayment.id
            matchScore = 0.95
          }
        }
        
        // Strategy 2: Name Fuzzy Matching (if no payment index match)
        if (!matchedResidentId && descriptionData.names.length > 0) {
          for (const name of descriptionData.names) {
            const nameMatch = findBestNameMatch(name, residentNameMap)
            if (nameMatch && nameMatch.similarity > 0.7) {
              matchedResidentId = nameMatch.residentId
              matchingStrategy = 'NAME_MATCH'
              matchScore = nameMatch.similarity * 0.6 // Lower confidence for name-only matches
              break
            }
          }
        }
        
        // Determine if auto-matched or needs review
        const isAutoMatched = matchScore >= 0.8
        // We no longer auto-verify on upload; mark for review instead
        if (matchScore > 0) {
          needsReviewCount++
        } else {
          needsReviewCount++
        }
        
        // Generate a temporary ID for the mutation (will be replaced after insertion)
        const tempMutationId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        
        // Prepare bank mutation data for bulk insert
        bankMutationsToInsert.push({
          id: tempMutationId, // Will be replaced with actual ID after insertion
          transactionDate,
          description: transaction.description,
          amount: transaction.amount,
          balance: transaction.balance,
          referenceNumber: transaction.reference,
          transactionType: transaction.transactionType,
          category: categorization.category,
          isOmitted: categorization.shouldOmit,
          omitReason: categorization.omitReason,
          matchedResidentId,
          matchedPaymentId,
          matchScore,
          matchingStrategy,
          rawData: JSON.stringify(transaction),
          uploadBatch: batchId,
          fileName: file.name,
          isVerified: false
        })

        // Prepare verification data for bulk insert
        bankVerificationsToInsert.push({
          mutationId: tempMutationId, // Will be updated with actual ID after insertion
          action: matchScore > 0 ? 'AUTO_MATCH' : 'SYSTEM_UNMATCH',
          confidence: matchScore,
          verifiedBy: 'SYSTEM',
          notes: `Initial match using ${matchingStrategy} strategy`
        })

        // Collect bank aliases for bulk update
        if (matchedResidentId && matchingStrategy === 'NAME_MATCH') {
          for (const name of descriptionData.names) {
            const nameMatch = findBestNameMatch(name, residentNameMap)
            if (nameMatch && nameMatch.residentId === matchedResidentId) {
              if (!aliasesToUpdate.has(matchedResidentId)) {
                aliasesToUpdate.set(matchedResidentId, [])
              }
              aliasesToUpdate.get(matchedResidentId)!.push({
                bankName: name,
                isVerified: isAutoMatched
              })
            }
          }
        }

        processedTransactions.push({
          id: tempMutationId, // Use temporary ID for now
          ...transaction,
          matchedResidentId,
          matchScore,
          matchingStrategy,
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
          uploadBatch: batchId
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: bankMutationsToInsert.length
      })
      
      // Update verification records with actual mutation IDs
      const verificationsToInsert = insertedMutationRecords.map((mutation: any, index: number) => ({
        mutationId: mutation.id,
        action: bankVerificationsToInsert[index].action,
        confidence: bankVerificationsToInsert[index].confidence,
        verifiedBy: bankVerificationsToInsert[index].verifiedBy,
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
      
      for (const [residentId, aliases] of aliasesToUpdate.entries()) {
        for (const alias of aliases) {
          await (db as any).residentBankAlias.upsert({
            where: {
              residentId_bankName: {
                residentId,
                bankName: alias.bankName
              }
            },
            update: {
              frequency: { increment: 1 },
              lastSeen: new Date(),
              isVerified: alias.isVerified
            },
            create: {
              residentId,
              bankName: alias.bankName,
              frequency: 1,
              isVerified: alias.isVerified
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
            r.blok && r.houseNumber && 
            `${r.blok} / ${r.houseNumber}` === houseMatch
          )
          
          if (resident) {
            // Create a bank mutation for historical data
            const historicalMutation = await (db as any).bankMutation.create({
              data: {
                transactionDate: new Date(historyItem.originalTransaction.date),
                description: historyItem.originalTransaction.description,
                amount: historyItem.originalTransaction.amount,
                balance: historyItem.originalTransaction.balance,
                transactionType: historyItem.originalTransaction.transactionType,
                matchedResidentId: resident.id,
                matchScore: 1.0,
                matchingStrategy: 'HISTORICAL_IMPORT',
                rawData: JSON.stringify(historyItem),
                uploadBatch: `HISTORICAL_${batchId}`,
                fileName: `historical_${file.name}`,
                isVerified: true,
                verifiedAt: new Date(),
                verifiedBy: 'HISTORICAL_IMPORT'
              }
            })
            
            // Store verification history for learning
            await (db as any).bankMutationVerification.create({
              data: {
                mutationId: historicalMutation.id,
                action: 'MANUAL_CONFIRM',
                confidence: 1.0,
                verifiedBy: 'HISTORICAL_IMPORT',
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
                        residentId: resident.id,
                        bankName: name
                      }
                    },
                    update: {
                      frequency: { increment: 1 },
                      lastSeen: new Date(),
                      isVerified: true
                    },
                    create: {
                      residentId: resident.id,
                      bankName: name,
                      frequency: 1,
                      isVerified: true
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
