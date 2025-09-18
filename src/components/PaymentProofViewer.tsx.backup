'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Eye, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Brain,
  FileImage,
  Info
} from 'lucide-react'

interface PaymentProof {
  id: string
  filename: string
  filePath: string
  fileSize: number
  mimeType: string
  analyzed: boolean
  analysisResult?: string
  createdAt: string
}

interface PaymentProofViewerProps {
  proofs: PaymentProof[]
  onAnalyze?: (proofId: string) => void
  onVerifyPayment?: (paymentId: string) => void
  paymentId?: string
}

interface AnalysisResult {
  amount?: number
  senderName?: string
  recipientName?: string
  transferDate?: string
  bankName?: string
  referenceNumber?: string
  notes?: string
  confidence?: number
  isTransferProof?: boolean
  error?: string
}

export default function PaymentProofViewer({ 
  proofs, 
  onAnalyze, 
  onVerifyPayment, 
  paymentId 
}: PaymentProofViewerProps) {
  const [selectedProof, setSelectedProof] = useState<PaymentProof | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)

  const handleAnalyze = async (proofId: string) => {
    if (!onAnalyze) return

    setAnalyzing(true)
    try {
      const response = await fetch(`/api/payment-proofs/${proofId}/analyze`, {
        method: 'POST',
      })

      if (!response.ok) throw new Error('Failed to analyze image')

      const data = await response.json()
      setAnalysisResult(data.analysisResult)
      
      // Refresh the proofs list
      onAnalyze(proofId)
    } catch (error) {
      console.error('Error analyzing proof:', error)
    } finally {
      setAnalyzing(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(amount)
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600'
    if (confidence >= 0.6) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return <Badge className="bg-green-100 text-green-800">Tinggi</Badge>
    if (confidence >= 0.6) return <Badge className="bg-yellow-100 text-yellow-800">Sedang</Badge>
    return <Badge className="bg-red-100 text-red-800">Rendah</Badge>
  }

  const parseAnalysisResult = (resultString?: string): AnalysisResult => {
    if (!resultString) return {}
    try {
      return JSON.parse(resultString)
    } catch {
      return { error: 'Invalid analysis result' }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Bukti Transfer</h3>
        <Badge variant="outline">{proofs.length} file</Badge>
      </div>

      <div className="grid gap-3">
        {proofs.map((proof) => {
          const analysis = parseAnalysisResult(proof.analysisResult)
          
          return (
            <Card key={proof.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileImage className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="font-medium">{proof.filename}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(proof.fileSize)} • {new Date(proof.createdAt).toLocaleDateString('id-ID')}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {proof.analyzed ? (
                    analysis.error ? (
                      <Badge variant="destructive">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Error
                      </Badge>
                    ) : analysis.isTransferProof ? (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Valid
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <Clock className="w-3 h-3 mr-1" />
                        Dianalisis
                      </Badge>
                    )
                  ) : (
                    <Badge variant="outline">
                      <Brain className="w-3 h-3 mr-1" />
                      Belum dianalisis
                    </Badge>
                  )}
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl">
                      <DialogHeader>
                        <DialogTitle>Detail Bukti Transfer</DialogTitle>
                        <DialogDescription>
                          {proof.filename} • {formatFileSize(proof.fileSize)}
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Image Preview */}
                        <div className="space-y-4">
                          <h4 className="font-medium">Preview Gambar</h4>
                          <div className="border rounded-lg overflow-hidden bg-gray-50">
                            <img
                              src={proof.filePath}
                              alt={proof.filename}
                              className="w-full h-auto max-h-96 object-contain"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" asChild>
                              <a href={proof.filePath} download={proof.filename}>
                                <Download className="w-4 h-4 mr-2" />
                                Download
                              </a>
                            </Button>
                            {!proof.analyzed && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleAnalyze(proof.id)}
                                disabled={analyzing}
                              >
                                <Brain className="w-4 h-4 mr-2" />
                                {analyzing ? 'Menganalisis...' : 'Analisis AI'}
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Analysis Results */}
                        <div className="space-y-4">
                          <h4 className="font-medium">Hasil Analisis AI</h4>
                          
                          {!proof.analyzed ? (
                            <Alert>
                              <Brain className="h-4 w-4" />
                              <AlertDescription>
                                Belum dianalisis. Klik tombol "Analisis AI" untuk memulai analisis gambar.
                              </AlertDescription>
                            </Alert>
                          ) : analysis.error ? (
                            <Alert variant="destructive">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>
                                {analysis.error}
                              </AlertDescription>
                            </Alert>
                          ) : (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    {analysis.isTransferProof ? (
                                      <CheckCircle className="h-4 w-4 text-green-600" />
                                    ) : (
                                      <AlertCircle className="h-4 w-4 text-red-600" />
                                    )}
                                    <span className="text-sm">
                                      {analysis.isTransferProof ? 'Bukti transfer valid' : 'Bukan bukti transfer'}
                                    </span>
                                  </div>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Confidence</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    {getConfidenceBadge(analysis.confidence || 0)}
                                    <span className={`text-sm font-medium ${getConfidenceColor(analysis.confidence || 0)}`}>
                                      {((analysis.confidence || 0) * 100).toFixed(1)}%
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {analysis.amount && (
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Jumlah Transfer</p>
                                  <p className="text-lg font-semibold">{formatCurrency(analysis.amount)}</p>
                                </div>
                              )}

                              {analysis.senderName && (
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Pengirim</p>
                                  <p className="text-sm">{analysis.senderName}</p>
                                </div>
                              )}

                              {analysis.recipientName && (
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Penerima</p>
                                  <p className="text-sm">{analysis.recipientName}</p>
                                </div>
                              )}

                              {analysis.transferDate && (
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Tanggal Transfer</p>
                                  <p className="text-sm">{new Date(analysis.transferDate).toLocaleDateString('id-ID')}</p>
                                </div>
                              )}

                              {analysis.bankName && (
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Bank</p>
                                  <p className="text-sm">{analysis.bankName}</p>
                                </div>
                              )}

                              {analysis.referenceNumber && (
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">No. Referensi</p>
                                  <p className="text-sm font-mono">{analysis.referenceNumber}</p>
                                </div>
                              )}

                              {analysis.notes && (
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Catatan</p>
                                  <p className="text-sm">{analysis.notes}</p>
                                </div>
                              )}

                              {analysis.isTransferProof && analysis.confidence && analysis.confidence > 0.8 && onVerifyPayment && (
                                <Alert>
                                  <Info className="h-4 w-4" />
                                  <AlertDescription className="space-y-2">
                                    <p className="font-medium">Saran Verifikasi Otomatis</p>
                                    <p className="text-sm">
                                      Analisis AI menunjukkan bukti transfer valid dengan confidence tinggi. 
                                      Anda dapat memverifikasi pembayaran ini secara otomatis.
                                    </p>
                                    <Button 
                                      size="sm" 
                                      onClick={() => onVerifyPayment(paymentId || '')}
                                      className="mt-2"
                                    >
                                      <CheckCircle className="w-4 h-4 mr-2" />
                                      Verifikasi Pembayaran
                                    </Button>
                                  </AlertDescription>
                                </Alert>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {proofs.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <FileImage className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>Belum ada bukti transfer yang diunggah</p>
        </div>
      )}
    </div>
  )
}