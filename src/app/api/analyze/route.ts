import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import ZAI from 'z-ai-web-dev-sdk'

interface AutoVerifySuggestion {
  action: 'VERIFY' | 'REVIEW'
  confidence: number
  reason: string
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const paymentProofId = formData.get('paymentProofId') as string
    const file = formData.get('file') as File

    if (!paymentProofId || !file) {
      return NextResponse.json(
        { error: 'Payment proof ID and file are required' },
        { status: 400 }
      )
    }

    // Get payment proof details
    const paymentProof = await db.paymentProof.findUnique({
      where: { id: paymentProofId },
      include: {
        payment: {
          include: {
            resident: true,
            period: true
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

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const mime_type = file.type

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
      "bank_name": string,
      "reference_number": string,
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

    const response = await fetch(`data:${mime_type};base64,${base64}`)
    const blob = await response.blob()
    
    // Convert blob to file for ZAI
    const analysisFile = new File([blob], 'transfer_proof.jpg', { type: mime_type })

    // For now, we'll use the chat completion with a detailed prompt
    // In a production environment, you might want to use vision models if available
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

    let analysis_result
    try {
      const content = completion.choices[0]?.message?.content
      if (content) {
        // Clean the response to ensure it's valid JSON
        const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        analysis_result = JSON.parse(cleanContent)
      } else {
        throw new Error('No analysis result received')
      }
    } catch (parseError) {
      console.error('Error parsing analysis result:', parseError)
      analysis_result = {
        amount: null,
        senderName: null,
        recipientName: null,
        transferDate: null,
        bank_name: null,
        reference_number: null,
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
        analysis_result: JSON.stringify(analysis_result)
      }
    })

    // If analysis is confident and shows valid transfer, suggest auto-verification
    let autoVerifySuggestion: AutoVerifySuggestion | null = null
    if (analysis_result.isTransferProof && analysis_result.confidence > 0.8) {
      const expectedAmount = paymentProof.payment.period.amount
      const extractedAmount = analysis_result.amount

      if (extractedAmount && Math.abs(extractedAmount - expectedAmount) < 1000) { // Allow small difference
        autoVerifySuggestion = {
          action: 'VERIFY',
          confidence: analysis_result.confidence,
          reason: `Amount matches expected IPL payment (${expectedAmount} vs ${extractedAmount})`
        }
      } else if (extractedAmount) {
        autoVerifySuggestion = {
          action: 'REVIEW',
          confidence: analysis_result.confidence,
          reason: `Amount mismatch: expected ${expectedAmount}, found ${extractedAmount}`
        }
      }
    }

    return NextResponse.json({
      analysis_result,
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
      const paymentProofId = (await request.formData()).get('paymentProofId') as string
      if (paymentProofId) {
        await db.paymentProof.update({
          where: { id: paymentProofId },
          data: {
            analyzed: true,
            analysis_result: JSON.stringify({
              error: error instanceof Error ? error.message : 'Analysis failed',
              confidence: 0,
              isTransferProof: false
            })
          }
        })
      }
    } catch (dbError) {
      console.error('Error updating payment proof:', dbError)
    }

    return NextResponse.json(
      { error: 'Failed to analyze image' },
      { status: 500 }
    )
  }
}
