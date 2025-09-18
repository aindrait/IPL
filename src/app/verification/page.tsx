'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import PaymentProofViewer from '@/components/PaymentProofViewer'
import {
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  FileText,
  AlertTriangle,
  DollarSign,
  Calendar,
  User,
  Phone,
  MapPin,
  Upload,
  ChevronDown,
  ChevronRight,
  Image,
  X,
  Filter,
  Search
} from 'lucide-react'

interface PendingPayment {
  id: string
  amount: number
  payment_date: string
  payment_method?: string
  notes?: string
  created_at: string
  status: string
  resident: {
    id: string
    name: string
    rt: number
    rw: number
    blok?: string
    house_number?: string
    address: string
    phone?: string
  }
  schedule_items: Array<{
    id: string
    type: string
    label?: string
    status: string
    amount: number
    originalAmount: number
    due_date: string
    notes?: string
    isAmountEdited: boolean
    period: {
      name: string
      month: number
      year: number
      amount: number
      due_date: string
    }
  }>
  periods: Array<{
    name: string
    month: number
    year: number
    amount: number
  }>
  proofs: Array<{
    id: string
    filename: string
    file_path: string
    file_size: number
    mime_type: string
    analyzed: boolean
    analysis_result?: string
    uploadedAt: string
  }>
  submittedBy: string
  totalScheduleAmount: number
  totalOriginalAmount: number
  amountMatch: boolean
  hasEditedAmounts: boolean
  hasProofs: boolean
  daysWaiting: number
}

interface VerificationData {
  payment_id: string
  action: 'approve' | 'reject'
  adminNotes: string
  verificationMethod: 'MANUAL_CHECK' | 'BANK_STATEMENT' | 'TRANSFER_PROOF'
  verificationDetails: {
    bankAccount?: string
    transferAmount?: number
    transferDate?: string
    reference_number?: string
  }
}

interface BankMutation {
  id: string
  transaction_date: string
  description: string
  amount: number
  transaction_type?: 'CR' | 'DB' | null
  category?: string | null
  is_omitted: boolean
  omit_reason?: string | null
  is_verified: boolean
  matched_resident_id?: string | null
  matched_payment_id?: string | null
  match_score?: number | null
  matching_strategy?: string | null
}

export default function VerificationPage() {
  const [payments, setPayments] = useState<PendingPayment[]>([])
  const [bankMutations, setBankMutations] = useState<BankMutation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPayment, setSelectedPayment] = useState<PendingPayment | null>(null)
  const [verificationDialog, setVerificationDialog] = useState(false)
  const [viewDialog, setViewDialog] = useState(false)
  const [verifying, setVerifying] = useState(false)
  
  // Filters
  const [rtFilter, setRtFilter] = useState<string>('all')
  const [monthFilter, setMonthFilter] = useState<string>('all')
  const [yearFilter, setYearFilter] = useState<string>(new Date().getFullYear().toString())
  const [statusFilter, setStatusFilter] = useState<string>('PENDING')
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [expandedProofs, setExpandedProofs] = useState<Set<string>>(new Set())
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0
  })
  const [summary, setSummary] = useState({
    totalPending: 0,
    totalAmount: 0,
    withProofs: 0,
    withoutProofs: 0
  })

  // Verification form state
  const [verification_data, setVerificationData] = useState<VerificationData>({
    payment_id: '',
    action: 'approve',
    adminNotes: '',
    verificationMethod: 'MANUAL_CHECK',
    verificationDetails: {}
  })

  useEffect(() => {
    fetchPendingPayments()
    fetchBankMutations()
  }, [pagination?.page, rtFilter, monthFilter, yearFilter, statusFilter, searchTerm])

  const fetchBankMutations = async () => {
    try {
      const params = new URLSearchParams({
        year: yearFilter,
        month: monthFilter,
        omitted: 'false' // Only fetch non-omitted transactions
      })
      
      const response = await fetch(`/api/bank-mutations?${params.toString()}`)
      const data = await response.json()
      
      setBankMutations(data.items || [])
    } catch (error) {
      console.error('Error fetching bank mutations:', error)
    }
  }

  const fetchPendingPayments = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: (pagination?.page || 1).toString(),
        limit: (pagination?.limit || 10).toString(),
        rt: rtFilter,
        month: monthFilter,
        year: yearFilter,
        status: statusFilter
      })
      
      if (searchTerm) {
        params.append('search', searchTerm)
      }
      
      const response = await fetch(`/api/payments/pending?${params.toString()}`)
      const data = await response.json()
      
      setPayments(data.payments || [])
      if (data.pagination) {
        setPagination(data.pagination)
      }
      setSummary(data.summary || {
        totalPending: 0,
        totalAmount: 0,
        withProofs: 0,
        withoutProofs: 0
      })
      
      // Also fetch bank mutations
      fetchBankMutations()
    } catch (error) {
      console.error('Error fetching pending payments:', error)
    } finally {
      setLoading(false)
    }
  }

  const openViewDialog = (payment: PendingPayment) => {
    setSelectedPayment(payment)
    setExpandedProofs(new Set()) // Reset expanded proofs when opening dialog
    setViewDialog(true)
  }

  const toggleProofExpanded = (proofId: string) => {
    setExpandedProofs(prev => {
      const newSet = new Set(prev)
      if (newSet.has(proofId)) {
        newSet.delete(proofId)
      } else {
        newSet.add(proofId)
      }
      return newSet
    })
  }

  const openVerificationDialog = (payment: PendingPayment, action: 'approve' | 'reject') => {
    setSelectedPayment(payment)
    setVerificationData({
      payment_id: payment.id,
      action,
      adminNotes: '',
      verificationMethod: 'MANUAL_CHECK',
      verificationDetails: {
        transferAmount: payment.amount,
        transferDate: payment.payment_date
      }
    })
    setVerificationDialog(true)
  }

  const matchPaymentWithBankMutations = (payment: PendingPayment) => {
    // Find bank mutations that match this payment
    const matchingMutations = bankMutations.filter(mutation => {
      // Match by resident ID if available
      if (mutation.matched_resident_id === payment.resident.id) {
        return true
      }
      
      // Match by amount and date (within 7 days)
      const payment_date = new Date(payment.payment_date)
      const mutationDate = new Date(mutation.transaction_date)
      const dateDiff = Math.abs(payment_date.getTime() - mutationDate.getTime()) / (1000 * 60 * 60 * 24)
      
      return (
        Math.abs(mutation.amount - payment.amount) < 100 && // Amount within 100 IDR
        dateDiff <= 7 && // Within 7 days
        !mutation.matched_payment_id // Not already matched
      )
    })
    
    return matchingMutations
  }

  const handleVerification = async () => {
    if (!selectedPayment) return
    
    setVerifying(true)
    try {
      const response = await fetch('/api/payments/verify-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verification_data)
      })

      const result = await response.json()
      if (response.ok) {
        alert(result.message)
        setVerificationDialog(false)
        fetchPendingPayments() // Refresh data
      } else {
        alert(result.error || 'Gagal melakukan verifikasi')
      }
    } catch (error) {
      console.error('Error verifying payment:', error)
      alert('Terjadi error saat verifikasi')
    } finally {
      setVerifying(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const hasActiveFilters = () => {
    return searchTerm !== '' ||
           rtFilter !== 'all' ||
           yearFilter !== new Date().getFullYear().toString() ||
           monthFilter !== 'all' ||
           statusFilter !== 'PENDING'
  }

  const clearFilters = () => {
    setSearchTerm('')
    setRtFilter('all')
    setYearFilter(new Date().getFullYear().toString())
    setMonthFilter('all')
    setStatusFilter('PENDING')
    setShowFilters(false)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Verification</h1>
          <p className="text-muted-foreground">Review and process pending payments</p>
        </div>
      </div>
      {/* Search and Filters */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Pencarian & Filter
            </CardTitle>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Search Bar */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by name, blok, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button
                variant={showFilters ? "default" : "outline"}
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Filter
                {hasActiveFilters() && (
                  <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center ml-1">
                    !
                  </span>
                )}
              </Button>
              
              {hasActiveFilters() && (
                <Button
                  variant="ghost"
                  onClick={clearFilters}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
              {/* RT Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">RT</Label>
                <Select value={rtFilter} onValueChange={setRtFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="RT" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All RT</SelectItem>
                    <SelectItem value="1">RT 1</SelectItem>
                    <SelectItem value="2">RT 2</SelectItem>
                    <SelectItem value="3">RT 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Year Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tahun</Label>
                <Select value={yearFilter} onValueChange={setYearFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {Array.from({ length: 5 }, (_, i) => {
                      const year = new Date().getFullYear() - i
                      return (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Month Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Bulan</Label>
                <Select value={monthFilter} onValueChange={setMonthFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    <SelectItem value="1">January</SelectItem>
                    <SelectItem value="2">February</SelectItem>
                    <SelectItem value="3">March</SelectItem>
                    <SelectItem value="4">April</SelectItem>
                    <SelectItem value="5">May</SelectItem>
                    <SelectItem value="6">June</SelectItem>
                    <SelectItem value="7">July</SelectItem>
                    <SelectItem value="8">August</SelectItem>
                    <SelectItem value="9">September</SelectItem>
                    <SelectItem value="10">October</SelectItem>
                    <SelectItem value="11">November</SelectItem>
                    <SelectItem value="12">December</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="VERIFIED">Verified</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                    <SelectItem value="all">All Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Active Filters Display */}
          {hasActiveFilters() && (
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="text-sm text-gray-600 font-medium">Filter aktif:</span>
              
              {searchTerm && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                  Search: "{searchTerm}"
                  <button onClick={() => setSearchTerm('')} className="hover:text-blue-600">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              
              {rtFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                  RT {rtFilter}
                  <button onClick={() => setRtFilter('all')} className="hover:text-green-600">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              
              {yearFilter !== 'all' && yearFilter !== new Date().getFullYear().toString() && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                  Tahun {yearFilter}
                  <button onClick={() => setYearFilter(new Date().getFullYear().toString())} className="hover:text-purple-600">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              
              {monthFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                  {new Date(0, parseInt(monthFilter) - 1).toLocaleDateString('id-ID', { month: 'long' })}
                  <button onClick={() => setMonthFilter('all')} className="hover:text-orange-600">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              
              {statusFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                  {statusFilter === 'PENDING' ? 'Pending' :
                   statusFilter === 'VERIFIED' ? 'Verified' :
                   statusFilter === 'REJECTED' ? 'Rejected' : statusFilter}
                  <button onClick={() => setStatusFilter('all')} className="hover:text-red-600">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Header & Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Pending</p>
                <p className="text-2xl font-bold">{summary.totalPending}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-lg font-bold">{formatCurrency(summary.totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">With Proofs</p>
                <p className="text-2xl font-bold text-blue-600">{summary.withProofs}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">No Proofs</p>
                <p className="text-2xl font-bold text-red-600">{summary.withoutProofs}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Payment Verification</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Tidak ada payment yang perlu diverifikasi
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Resident</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Periods</TableHead>
                  <TableHead>Proofs</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{payment.resident.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {payment.resident.blok && payment.resident.house_number ? 
                            `${payment.resident.blok}${payment.resident.house_number}` : 
                            payment.resident.address
                          } • RT {payment.resident.rt}/RW {payment.resident.rw}
                        </p>
                        {payment.resident.phone && (
                          <p className="text-xs text-muted-foreground">{payment.resident.phone}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{formatCurrency(payment.amount)}</p>
                        {!payment.amountMatch && !payment.hasEditedAmounts && (
                          <Badge variant="destructive" className="text-xs">
                            Amount Mismatch
                          </Badge>
                        )}
                        {payment.hasEditedAmounts && (
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                            Edited Amounts
                          </Badge>
                        )}
                        {payment.hasEditedAmounts && (
                          <p className="text-xs text-muted-foreground">
                            Original: {formatCurrency(payment.totalOriginalAmount)}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {payment.periods.map((period, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {period.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {payment.hasProofs ? (
                          <>
                            <FileText className="h-4 w-4 text-green-500" />
                            <span className="text-sm">{payment.proofs.length} files</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            <span className="text-sm text-red-600">No proofs</span>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {payment.status === 'PENDING' && (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      )}
                      {payment.status === 'VERIFIED' && (
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                      {payment.status === 'REJECTED' && (
                        <Badge variant="outline" className="bg-red-50 text-red-700">
                          <XCircle className="h-3 w-3 mr-1" />
                          Rejected
                        </Badge>
                      )}
                      {!payment.status && (
                        <Badge variant="outline" className="bg-gray-50 text-gray-700">
                          <Clock className="h-3 w-3 mr-1" />
                          Unknown
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm ${payment.daysWaiting > 3 ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                        {payment.daysWaiting} days
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openViewDialog(payment)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => openVerificationDialog(payment, 'approve')}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openVerificationDialog(payment, 'reject')}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Verification Dialog */}
      <Dialog open={verificationDialog} onOpenChange={setVerificationDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {verification_data.action === 'approve' ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              {verification_data.action === 'approve' ? 'Approve' : 'Reject'} Payment
            </DialogTitle>
          </DialogHeader>
          
          {selectedPayment && (
            <div className="space-y-4">
              {/* Payment Summary */}
              <Alert>
                <AlertDescription>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>Resident:</strong> {selectedPayment.resident.name}
                    </div>
                    <div>
                      <strong>Amount:</strong> {formatCurrency(selectedPayment.amount)}
                    </div>
                    <div>
                      <strong>Payment Date:</strong> {selectedPayment.payment_date}
                    </div>
                    <div>
                      <strong>Method:</strong> {selectedPayment.payment_method || 'Not specified'}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

              {/* Verification Method */}
              <div>
                <Label>Verification Method</Label>
                <Select 
                  value={verification_data.verificationMethod}
                  onValueChange={(value: 'MANUAL_CHECK' | 'BANK_STATEMENT' | 'TRANSFER_PROOF') => setVerificationData(prev => ({...prev, verificationMethod: value}))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MANUAL_CHECK">Manual Check</SelectItem>
                    <SelectItem value="BANK_STATEMENT">Bank Statement</SelectItem>
                    <SelectItem value="TRANSFER_PROOF">Transfer Proof</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Verification Details */}
              {verification_data.verificationMethod !== 'MANUAL_CHECK' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Bank Account</Label>
                    <Input 
                      value={verification_data.verificationDetails.bankAccount || ''}
                      onChange={(e) => setVerificationData(prev => ({
                        ...prev, 
                        verificationDetails: {...prev.verificationDetails, bankAccount: e.target.value}
                      }))}
                      placeholder="Account number"
                    />
                  </div>
                  <div>
                    <Label>Reference Number</Label>
                    <Input 
                      value={verification_data.verificationDetails.reference_number || ''}
                      onChange={(e) => setVerificationData(prev => ({
                        ...prev, 
                        verificationDetails: {...prev.verificationDetails, reference_number: e.target.value}
                      }))}
                      placeholder="Transfer reference"
                    />
                  </div>
                </div>
              )}

              {/* Admin Notes */}
              <div>
                <Label>Admin Notes</Label>
                <Textarea 
                  value={verification_data.adminNotes}
                  onChange={(e) => setVerificationData(prev => ({...prev, adminNotes: e.target.value}))}
                  placeholder="Add verification notes..."
                  rows={3}
                />
              </div>

              {/* Payment Proofs */}
              {selectedPayment.proofs.length > 0 && (
                <div>
                  <Label>Payment Proofs ({selectedPayment.proofs.length})</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {selectedPayment.proofs.map((proof) => (
                      <div key={proof.id} className="border rounded p-2 text-sm">
                        <p className="font-medium truncate">{proof.filename}</p>
                        <p className="text-muted-foreground">{formatFileSize(proof.file_size)}</p>
                        {proof.analyzed && proof.analysis_result && (
                          <p className="text-xs text-blue-600 mt-1">AI: {proof.analysis_result}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setVerificationDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleVerification}
                  disabled={verifying}
                  className={verification_data.action === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
                  variant={verification_data.action === 'approve' ? 'default' : 'destructive'}
                >
                  {verifying ? 'Processing...' : (
                    verification_data.action === 'approve' ? 'Approve Payment' : 'Reject Payment'
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Payment Details Dialog */}
      <Dialog open={viewDialog} onOpenChange={setViewDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto w-[95vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-600" />
              Payment Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedPayment && (
            <div className="space-y-6">
              {/* Payment Summary */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">Payment Information</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount:</span>
                      <span className="font-medium">{formatCurrency(selectedPayment.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payment Date:</span>
                      <span>{selectedPayment.payment_date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Method:</span>
                      <span>{selectedPayment.payment_method || 'Not specified'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Submitted:</span>
                      <span>{new Date(selectedPayment.created_at).toLocaleDateString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Days Waiting:</span>
                      <span className={selectedPayment.daysWaiting > 3 ? 'text-red-600 font-medium' : ''}>
                        {selectedPayment.daysWaiting} days
                      </span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-3">Resident Information</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span className="font-medium">{selectedPayment.resident.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Address:</span>
                      <span>
                        {selectedPayment.resident.blok && selectedPayment.resident.house_number ? 
                          `${selectedPayment.resident.blok}${selectedPayment.resident.house_number}` : 
                          selectedPayment.resident.address
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">RT/RW:</span>
                      <span>RT {selectedPayment.resident.rt}/RW {selectedPayment.resident.rw}</span>
                    </div>
                    {selectedPayment.resident.phone && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Phone:</span>
                        <span>{selectedPayment.resident.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Schedule Items Details */}
              <div>
                <h3 className="font-semibold mb-3">Schedule Items</h3>
                <div className="space-y-3">
                  {selectedPayment.schedule_items && selectedPayment.schedule_items.length > 0 ? (
                    selectedPayment.schedule_items.map((item) => (
                    <div key={item.id} className="border rounded-lg p-4 bg-gray-50">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Period & Type */}
                        <div>
                          <p className="text-sm text-muted-foreground">Period & Type</p>
                          <p className="font-medium">{item.period.name}</p>
                          <Badge variant="outline" className="mt-1">
                            {item.type === 'MONTHLY' ? 'IPL' : 
                             item.type === 'SPECIAL' ? 'THR' : 'Sumbangan'}
                          </Badge>
                        </div>
                        
                        {/* Amounts */}
                        <div>
                          <p className="text-sm text-muted-foreground">Amount Details</p>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Original:</span>
                              <span className="font-medium">{formatCurrency(item.originalAmount)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Current:</span>
                              <span className="font-medium">{formatCurrency(item.amount)}</span>
                              {item.isAmountEdited && (
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                                  Edited
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Status & Notes */}
                        <div>
                          <p className="text-sm text-muted-foreground">Status</p>
                          <Badge 
                            variant={item.status === 'PLANNED' ? 'default' : 'outline'}
                            className={`${item.status === 'OPTIONAL' ? 'bg-yellow-100 text-yellow-800' : ''} mb-2`}
                          >
                            {item.status}
                          </Badge>
                          {item.notes && (
                            <div className="mt-2">
                              <p className="text-xs text-muted-foreground">Notes:</p>
                              <p className="text-sm">{item.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No schedule items found for this payment.</p>
                    </div>
                  )}
                </div>
                
                {/* Amount Summary */}
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total Original:</span>
                      <p className="font-medium">{formatCurrency(selectedPayment.totalOriginalAmount)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Current:</span>
                      <p className="font-medium">{formatCurrency(selectedPayment.totalScheduleAmount)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Payment Amount:</span>
                      <p className="font-medium">{formatCurrency(selectedPayment.amount)}</p>
                    </div>
                  </div>
                  
                  {selectedPayment.hasEditedAmounts && (
                    <Alert className="mt-3">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        This payment contains schedule items with edited amounts. The amounts may have been 
                        adjusted due to dispensations, corrections, or special circumstances.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {!selectedPayment.amountMatch && !selectedPayment.hasEditedAmounts && (
                    <Alert className="mt-3" variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Payment amount ({formatCurrency(selectedPayment.amount)}) does not match 
                        total schedule amount ({formatCurrency(selectedPayment.totalScheduleAmount)}).
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>

              {/* Payment Proofs */}
              {selectedPayment.proofs.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Payment Proofs ({selectedPayment.proofs.length})</h3>
                  <div className="space-y-4">
                    {selectedPayment.proofs.map((proof) => {
                      const isExpanded = expandedProofs.has(proof.id)
                      const isImage = proof.mime_type?.startsWith('image/')
                      
                      return (
                        <div key={proof.id} className="border rounded-lg overflow-hidden">
                          <Collapsible open={isExpanded} onOpenChange={() => toggleProofExpanded(proof.id)}>
                            <CollapsibleTrigger className="w-full p-4 hover:bg-gray-50 transition-colors">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  {isImage ? (
                                    <Image className="h-5 w-5 text-green-500" />
                                  ) : (
                                    <FileText className="h-5 w-5 text-blue-500" />
                                  )}
                                  <div className="text-left">
                                    <p className="text-sm font-medium">{proof.filename}</p>
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                      <span>Size: {formatFileSize(proof.file_size)}</span>
                                      <span>Uploaded: {new Date(proof.uploadedAt).toLocaleDateString('id-ID')}</span>
                                      {isImage && (
                                        <Badge variant="outline" className="bg-green-50 text-green-700">
                                          Image
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                            </CollapsibleTrigger>
                            
                            <CollapsibleContent>
                              <div className="px-4 pb-4 border-t bg-gray-50">
                                {isImage ? (
                                  <div className="mt-4 space-y-3">
                                    {/* Image Preview */}
                                    <div className="bg-white rounded-lg p-2 border">
                                      <img 
                                        src={proof.file_path || `/uploads/${proof.filename}`}
                                        alt={`Payment proof: ${proof.filename}`}
                                        className="max-w-full max-h-96 mx-auto rounded object-contain"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement
                                          target.style.display = 'none'
                                          const parent = target.parentElement
                                          if (parent) {
                                            parent.innerHTML = `
                                              <div class="flex flex-col items-center justify-center h-32 text-muted-foreground">
                                                <div class="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center mb-2">
                                                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                                  </svg>
                                                </div>
                                                <p class="text-sm">Image not available</p>
                                                <p class="text-xs">${proof.filename}</p>
                                              </div>
                                            `
                                          }
                                        }}
                                      />
                                    </div>
                                    
                                    {/* Image Details */}
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <span className="text-muted-foreground">File Type:</span>
                                        <p className="font-medium">{proof.mime_type}</p>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">File Size:</span>
                                        <p className="font-medium">{formatFileSize(proof.file_size)}</p>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="mt-4">
                                    <p className="text-sm text-muted-foreground mb-2">Non-image file</p>
                                    <div className="bg-white rounded p-3 border">
                                      <div className="flex items-center gap-2">
                                        <FileText className="h-5 w-5 text-blue-500" />
                                        <div>
                                          <p className="font-medium">{proof.filename}</p>
                                          <p className="text-sm text-muted-foreground">{proof.mime_type}</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                {/* AI Analysis Results */}
                                {proof.analyzed && proof.analysis_result && (
                                  <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                      <span className="font-medium text-blue-800">AI Analysis Result</span>
                                    </div>
                                    <p className="text-sm text-blue-700">{proof.analysis_result}</p>
                                  </div>
                                )}
                                
                                {/* Download/View Actions */}
                                <div className="mt-4 flex gap-2">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => window.open(proof.file_path || `/uploads/${proof.filename}`, '_blank')}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    View Full Size
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => {
                                      const link = document.createElement('a')
                                      link.href = proof.file_path || `/uploads/${proof.filename}`
                                      link.download = proof.filename
                                      link.click()
                                    }}
                                  >
                                    <Upload className="h-4 w-4 mr-1" />
                                    Download
                                  </Button>
                                </div>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Matching Bank Mutations */}
              {selectedPayment && (
                <div>
                  <h3 className="font-semibold mb-3">Matching Bank Mutations</h3>
                  {(() => {
                    const matchingMutations = matchPaymentWithBankMutations(selectedPayment)
                    return matchingMutations.length > 0 ? (
                      <div className="space-y-3">
                        {matchingMutations.map((mutation) => (
                          <div key={mutation.id} className="border rounded-lg p-4 bg-gray-50">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <p className="text-sm text-muted-foreground">Date & Amount</p>
                                <p className="font-medium">{new Date(mutation.transaction_date).toLocaleDateString('id-ID')}</p>
                                <p className="font-medium">{formatCurrency(mutation.amount)}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Description</p>
                                <p className="text-sm truncate">{mutation.description}</p>
                                {mutation.category && (
                                  <Badge variant="outline" className="mt-1">
                                    {mutation.category}
                                  </Badge>
                                )}
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Match Info</p>
                                <p className="text-sm">
                                  {mutation.match_score ? `${Math.round(mutation.match_score * 100)}%` : 'No score'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {mutation.matching_strategy || 'Unknown strategy'}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        No matching bank mutations found
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Payment Notes */}
              {selectedPayment.notes && (
                <div>
                  <h3 className="font-semibold mb-3">Payment Notes</h3>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm">{selectedPayment.notes}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
