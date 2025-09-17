import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import ZAI from 'z-ai-web-dev-sdk'
import { promises as fs } from 'fs'
import path from 'path'

interface AutoVerifySuggestion {
  action: 'VERIFY' | 'REVIEW'
  confidence: number
  reason: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const paymentProofId = params.id

    // Get payment proof details
    const paymentProof = await (db as any).paymentProof.findUnique({
      where: { id: paymentProofId },
      include: {
        payment: {
          include: {
            resident: true,
          }
        }
      }
    })

    if (!paymentProof) {
      return NextResponse.json(
        { error: 'Payment proof not found' },
        { status: 404 }
      )
    }

    // Check if file exists
    const filePath = path.join(process.cwd(), 'public', paymentProof.filePath)
    try {
      await fs.access(filePath)
    } catch {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // Read file and convert to base64
    const fileBuffer = await fs.readFile(filePath)
    const base64 = fileBuffer.toString('base64')
    const mimeType = paymentProof.mimeType

    // Initialize ZAI SDK
    const zai = await ZAI.create()

    // Analyze image using AI
    const analysisPrompt = `
    Analyze this bank transfer proof image and extract the following information in JSON format:
    {
      "amount": number,
      "senderName": string,
      "recipientName": string,
      "transferDate": string (YYYY-MM-DD format),
      "bankName": string,
      "referenceNumber": string,
      "notes": string,
      "confidence": number (0-1),
      "isTransferProof": boolean
    }

    Guidelines:
    - Extract the transfer amount carefully, look for currency symbols like Rp or IDR
    - Identify the sender name (usually the person who made the transfer)
    - Extract the transfer date in YYYY-MM-DD format
    - Identify the bank name if visible
    - Set confidence score based on clarity of the image
    - Set isTransferProof to true only if this appears to be a valid bank transfer receipt
    - If information is not clearly visible, use null for that field
    - Respond with ONLY the JSON object, no additional text
    `

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing bank transfer proof images. Extract information accurately and respond only in JSON format.'
        },
        {
          role: 'user',
          content: analysisPrompt
        }
      ],
      temperature: 0.1, // Low temperature for more consistent results
    })

    let analysisResult
    try {
      const content = completion.choices[0]?.message?.content
      if (content) {
        // Clean the response to ensure it's valid JSON
        const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        analysisResult = JSON.parse(cleanContent)
      } else {
        throw new Error('No analysis result received')
      }
    } catch (parseError) {
      console.error('Error parsing analysis result:', parseError)
      analysisResult = {
        amount: null,
        senderName: null,
        recipientName: null,
        transferDate: null,
        bankName: null,
        referenceNumber: null,
        notes: 'Failed to parse analysis result',
        confidence: 0,
        isTransferProof: false
      }
    }

    // Update payment proof with analysis results
    await db.paymentProof.update({
      where: { id: paymentProofId },
      data: {
        analyzed: true,
        analysisResult: JSON.stringify(analysisResult)
      }
    })

    // If analysis is confident and shows valid transfer, suggest auto-verification
    let autoVerifySuggestion: AutoVerifySuggestion | null = null
    if (analysisResult.isTransferProof && analysisResult.confidence > 0.8) {
      const expectedAmount = (paymentProof as any).payment?.amount || (paymentProof as any).payment?.totalAmount || null
      const extractedAmount = analysisResult.amount

      if (extractedAmount && expectedAmount && Math.abs(extractedAmount - expectedAmount) < 1000) { // Allow small difference
        autoVerifySuggestion = {
          action: 'VERIFY',
          confidence: analysisResult.confidence,
          reason: `Amount matches expected IPL payment (${expectedAmount} vs ${extractedAmount})`
        }
      } else if (extractedAmount) {
        autoVerifySuggestion = {
          action: 'REVIEW',
          confidence: analysisResult.confidence,
          reason: `Amount mismatch: expected ${expectedAmount}, found ${extractedAmount}`
        }
      }
    }

    return NextResponse.json({
      analysisResult,
      autoVerifySuggestion,
      paymentProof: {
        id: paymentProof.id,
        filename: paymentProof.filename,
        analyzed: true
      }
    })

  } catch (error) {
    console.error('Error analyzing image:', error)
    
    // Update payment proof to mark as analyzed but with error
    try {
      await db.paymentProof.update({
        where: { id: params.id },
        data: {
          analyzed: true,
          analysisResult: JSON.stringify({
            error: error instanceof Error ? error.message : 'Analysis failed',
            confidence: 0,
            isTransferProof: false
          })
        }
      })
    } catch (dbError) {
      console.error('Error updating payment proof:', dbError)
    }

    return NextResponse.json(
      { error: 'Failed to analyze image' },
      { status: 500 }
    )
  }
}
