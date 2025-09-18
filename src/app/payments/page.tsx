'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination'
import PaymentProofViewer from '@/components/PaymentProofViewer'
import {
  Plus,
  Search,
  Trash2,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  Calendar,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle,
  Clock,
  Upload,
  X,
  Filter
} from 'lucide-react'

interface Payment {
  id: string
  amount: number
  paymentDate: string
  status: 'PENDING' | 'VERIFIED' | 'REJECTED'
  paymentMethod?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
  resident: {
    id: string
    name: string
    address: string
    phone: string
    rt: number
    rw: number
    blok?: string
    houseNumber?: string
  }
  scheduleItems?: {
    id: string
    type: string
    label?: string | null
    status: string
    amount: number
    dueDate: string
    paidDate?: string | null
    period: {
      id: string
      name: string
      month: number
      year: number
      amount: number
      dueDate: string
    }
  }[]
  createdBy: {
    id: string
    name?: string | null
    email: string
  }
  proofs: PaymentProof[]
}

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

interface Period {
  id: string
  name: string
  month: number
  year: number
  amount: number
  dueDate: string
  isActive: boolean
  _count: {
    payments: number
  }
}

interface Resident {
  id: string
  name: string
  address: string
  phone: string
  rt: number
  rw: number
  blok?: string
  houseNumber?: string
  paymentIndex?: number
}

interface PaymentsResponse {
  payments: Payment[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

type ScheduleItem = {
  id: string
  type: 'MONTHLY' | 'SPECIAL' | 'DONATION'
  label: string | null
  amount: number
  dueDate: string
  status: 'PLANNED' | 'PAID' | 'SKIPPED' | 'CARRIED_OVER' | 'OPTIONAL'
  indexCode?: string
  period: { id: string; name: string; month: number; year: number; amount: number; dueDate: string }
}

interface FormData {
  residentId: string
  periodId: string
  amount: number
  paymentDate: string
  paymentMethod?: string
  notes?: string
  scheduleItemId?: string
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [periods, setPeriods] = useState<Period[]>([])
  const [residents, setResidents] = useState<Resident[]>([])
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [rtFilter, setRtFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString())
  const [showFilters, setShowFilters] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [formData, setFormData] = useState<FormData>({
    residentId: '',
    periodId: '',
    amount: 0,
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: '',
    notes: '',
    scheduleItemId: undefined
  })
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  // Schedules-driven state
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([])
  const [startIndex, setStartIndex] = useState<string>('')
  const [numMonths, setNumMonths] = useState<number>(1)
  const [selectedExtraIds, setSelectedExtraIds] = useState<string[]>([]) // THR/Sumbangan
  // Removed isMultiplePeriodMode - always use period selection approach

  useEffect(() => {
    fetchPayments()
    fetchPeriods()
    fetchResidents()
  }, [pagination.page, pagination.limit, searchTerm, statusFilter, rtFilter, yearFilter])

  // Fetch resident schedules when resident selection changes (dialog)
  useEffect(() => {
    const load = async () => {
      if (!formData.residentId) {
        setScheduleItems([])
        return
      }
      try {
        const params = new URLSearchParams({ 
          residentId: formData.residentId, 
          limit: '200',
          includePaid: 'false' // Exclude PAID and SKIPPED items for payment creation
        })
        const res = await fetch(`/api/schedules/items?${params.toString()}`)
        const data = await res.json()
        setScheduleItems((data.items || []) as ScheduleItem[])
      } catch (e) {
        console.error('Error fetching resident schedules', e)
        setScheduleItems([])
      }
    }
    load()
  }, [formData.residentId])

  // When resident changes, reset schedule-related selections
  useEffect(() => {
    setFormData((prev) => ({ ...prev, periodId: '', scheduleItemId: undefined }))
    setStartIndex('')
    setNumMonths(1)
    setSelectedExtraIds([])
  }, [formData.residentId])

  const residentById = useMemo(() => {
    const map: Record<string, Resident> = {}
    for (const r of residents) map[r.id] = r as Resident
    return map
  }, [residents])

  const monthlyItems = useMemo(() =>
    scheduleItems
      .filter((it) => it.type === 'MONTHLY')
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
  , [scheduleItems])

  const monthlyStartOptions = useMemo(() => monthlyItems.map((it) => it.indexCode || it.period.name), [monthlyItems])

  const consecutiveSelection = useMemo(() => {
    if (!startIndex || numMonths <= 0) return [] as ScheduleItem[]
    const startIdx = monthlyItems.findIndex((it) => (it.indexCode || '') === startIndex)
    if (startIdx < 0) return []
    return monthlyItems.slice(startIdx, startIdx + numMonths)
  }, [startIndex, numMonths, monthlyItems])

  const selectedExtraItems = useMemo(() => scheduleItems.filter((it) => selectedExtraIds.includes(it.id)), [scheduleItems, selectedExtraIds])

  const selectedAllItems = useMemo(() => {
    const ids = new Set<string>()
    
    // Add consecutive selection items (period selection)
    for (const it of consecutiveSelection) ids.add(it.id)
    
    // Add extra items (THR/Sumbangan)
    for (const it of selectedExtraItems) ids.add(it.id)
    
    return scheduleItems.filter((it) => ids.has(it.id))
  }, [consecutiveSelection, selectedExtraItems, scheduleItems])

  const suggestedTotal = useMemo(() => selectedAllItems.reduce((sum, it) => sum + (it.amount || 0), 0), [selectedAllItems])

  // Calculate suggested transfer amount with payment index
  const suggestedTransferAmount = useMemo(() => {
    if (formData.residentId && selectedAllItems.length > 0) {
      const resident = residentById[formData.residentId]
      const baseAmount = suggestedTotal
      const paymentIndex = resident?.paymentIndex || 0
      
      if (paymentIndex > 0) {
        // Combine base amount with payment index (e.g., {parseInt((process.env.NEXT_PUBLIC_IPL_BASE_AMOUNT || "200000").split(',')[0], 10) || 200000} + 111 = {parseInt((process.env.NEXT_PUBLIC_IPL_BASE_AMOUNT || "200000").split(',')[0], 10) || 200000}111)
        return baseAmount + paymentIndex
      }
    }
    return suggestedTotal
  }, [formData.residentId, selectedAllItems.length, suggestedTotal, residentById])

  // Auto-fill amount when selection changes
  useEffect(() => {
    if (suggestedTransferAmount > 0) {
      setFormData(prev => ({ ...prev, amount: suggestedTransferAmount }))
    }
  }, [suggestedTransferAmount])

  const fetchPayments = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      })

      if (searchTerm) params.append('search', searchTerm)
      if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter)
      if (rtFilter && rtFilter !== 'all') params.append('rt', rtFilter)
      if (yearFilter && yearFilter !== 'all') params.append('year', yearFilter)

      console.log('Fetching payments with params:', params.toString())
      const response = await fetch(`/api/payments?${params}`)
      
      console.log('Response status:', response.status)
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Response error:', errorText)
        throw new Error(`Gagal mengambil data pembayaran: ${errorText}`)
      }

      const data: PaymentsResponse = await response.json()
      console.log('Payments data:', data)
      
      // The API now returns properly formatted data, no need to transform
      setPayments(data.payments)
      setPagination(data.pagination)
    } catch (error) {
      console.error('Error fetching payments:', error)
      setError(error instanceof Error ? error.message : 'Gagal mengambil data pembayaran')
    } finally {
      setLoading(false)
    }
  }

  const fetchPeriods = async () => {
    try {
      const response = await fetch('/api/periods?activeOnly=true')
      if (!response.ok) throw new Error('Gagal mengambil data periode')
      
      const data = await response.json()
      setPeriods(data)
    } catch (error) {
      console.error('Error fetching periods:', error)
    }
  }

  const fetchResidents = async () => {
    try {
      const response = await fetch('/api/residents?limit=100')
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Response error:', errorText)
        throw new Error('Gagal mengambil data warga')
      }
      
      const data = await response.json()
      console.log('Residents data:', data)
      setResidents(data.residents || [])
    } catch (error) {
      console.error('Error fetching residents:', error)
      setResidents([])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      // If user chose multiple schedules (consecutive or extra), use bulk API
      if (selectedAllItems.length > 1) {
        let response: Response
        
        // Check if there are files to upload
        if (selectedFiles.length > 0) {
          // Use FormData for file uploads
          const formDataObj = new FormData()
          formDataObj.append('itemIds', JSON.stringify(selectedAllItems.map((it) => it.id)))
          formDataObj.append('paymentDate', formData.paymentDate)
          if (formData.paymentMethod) formDataObj.append('paymentMethod', formData.paymentMethod)
          if (formData.notes) formDataObj.append('notes', formData.notes)
          
          // Add files
          selectedFiles.forEach((file, index) => {
            console.log(`Adding bulk payment file ${index + 1}:`, { name: file.name, size: file.size, type: file.type })
            formDataObj.append('files', file)
          })
          
          console.log('=== BULK PAYMENT REQUEST WITH FILES ===')
          console.log('FormData contents:')
          for (let [key, value] of formDataObj.entries()) {
            if (key === 'files') {
              console.log('Files:', Array.from(formDataObj.getAll('files')).map((f: any) => ({ name: f.name, size: f.size, type: f.type })))
            } else {
              console.log(`${key}: ${value}`)
            }
          }
          
          response = await fetch('/api/payments', {
            method: 'PUT',
            body: formDataObj, // FormData, no Content-Type header
          })
        } else {
          // Use JSON for no files
          const payload = {
            itemIds: selectedAllItems.map((it) => it.id),
            paymentDate: formData.paymentDate,
            paymentMethod: formData.paymentMethod,
            notes: formData.notes,
          }
          response = await fetch('/api/payments', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        }
        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(errorText || 'Gagal membuat pembayaran massal')
        }
        await fetchPayments()
        setIsDialogOpen(false)
        resetForm()
        return
      }

      // Require at least one selected schedule item for single payment
      if (selectedAllItems.length === 0) {
        setError('Pilih minimal satu item/periode pembayaran sebelum menyimpan')
        setSubmitting(false)
        return
      }

      // Enhanced logging: Log initial form data
      console.log('=== PAYMENT SUBMISSION DEBUG ===')
      console.log('Initial formData:', formData)
      console.log('Selected files count:', selectedFiles.length)
      console.log('Editing payment:', editingPayment?.id)

      const formDataObj = new FormData()

      // Prepare single selected item details
      const selectedItem = selectedAllItems[0]

      // Validate mandatory fields
      if (!formData.residentId) {
        setError('Warga harus dipilih')
        setSubmitting(false)
        return
      }

      // Append required fields safely
      formDataObj.append('residentId', String(formData.residentId))
      if (selectedItem?.period?.id) {
        formDataObj.append('periodId', String(selectedItem.period.id))
      }
      if (selectedItem?.id) {
        formDataObj.append('scheduleItemId', String(selectedItem.id))
      }
      formDataObj.append('amount', String(formData.amount))
      formDataObj.append('paymentDate', String(formData.paymentDate))
      if (formData.paymentMethod) formDataObj.append('paymentMethod', String(formData.paymentMethod))
      if (formData.notes) formDataObj.append('notes', String(formData.notes))

      // Add files
      selectedFiles.forEach((file, index) => {
        console.log(`Adding file ${index + 1}:`, { name: file.name, size: file.size, type: file.type })
        formDataObj.append('files', file)
      })

      const url = editingPayment ? `/api/payments/${editingPayment.id}` : '/api/payments'
      const method = editingPayment ? 'PUT' : 'POST'

      console.log('=== REQUEST DETAILS ===')
      console.log('URL:', url)
      console.log('Method:', method)
      console.log('FormData contents:')
      for (let [key, value] of formDataObj.entries()) {
        if (key === 'files') {
          console.log('Files:', Array.from(formDataObj.getAll('files')).map((f: any) => ({ name: f.name, size: f.size, type: f.type })))
        } else {
          console.log(`${key}: ${value}`)
        }
      }

      // Enhanced logging: Log request headers
      console.log('=== SENDING REQUEST ===')
      const startTime = Date.now()
      
      const response = await fetch(url, {
        method,
        body: formDataObj,
      })

      const endTime = Date.now()
      console.log(`=== RESPONSE RECEIVED (${endTime - startTime}ms) ===`)
      console.log('Response status:', response.status)
      console.log('Response status text:', response.statusText)
      console.log('Response headers:', Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        const errorText = await response.text()
        console.log('=== ERROR RESPONSE ===')
        console.log('Error response text:', errorText)
        console.log('Error response length:', errorText.length)
        
        let errorData
        try {
          errorData = JSON.parse(errorText)
          console.log('Parsed error data:', errorData)
        } catch (e) {
          console.log('Failed to parse error response as JSON:', e)
          errorData = { error: errorText || 'Gagal menyimpan pembayaran' }
        }
        
        console.log('Final error object:', errorData)
        throw new Error(errorData.error || 'Gagal menyimpan pembayaran')
      }

      const successData = await response.json()
      console.log('=== SUCCESS RESPONSE ===')
      console.log('Success data:', successData)

      await fetchPayments()
      setIsDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error('=== CATCH BLOCK ERROR ===')
      console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error)
      console.error('Error message:', error instanceof Error ? error.message : error)
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
      setError(error instanceof Error ? error.message : 'Gagal menyimpan pembayaran')
    } finally {
      setSubmitting(false)
      console.log('=== SUBMISSION COMPLETED ===')
    }
  }


  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus pembayaran ini?')) return

    try {
      const response = await fetch(`/api/payments/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Gagal menghapus pembayaran')
      }

      await fetchPayments()
    } catch (error) {
      console.error('Error deleting payment:', error)
      setError(error instanceof Error ? error.message : 'Gagal menghapus pembayaran')
    }
  }

  const handleAnalyzeProof = async (proofId: string) => {
    await fetchPayments() // Refresh to get updated analysis results
  }

  const handleVerifyPayment = async (paymentId: string) => {
    try {
      const response = await fetch(`/api/payments/${paymentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'VERIFIED' }),
      })

      if (!response.ok) throw new Error('Gagal memverifikasi pembayaran')

      await fetchPayments()
    } catch (error) {
      console.error('Error verifying payment:', error)
      setError('Gagal memverifikasi pembayaran')
    }
  }

  const resetForm = () => {
    setFormData({
      residentId: '',
      periodId: '',
      amount: 0,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: '',
      notes: '',
      scheduleItemId: undefined
    })
    setSelectedFiles([])
    setEditingPayment(null)
    setError('')
    setScheduleItems([])
    setStartIndex('')
    setNumMonths(1)
    setSelectedExtraIds([])
  }

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setSelectedFiles(prev => [...prev, ...files])
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Terverifikasi</Badge>
      case 'PENDING':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Menunggu</Badge>
      case 'REJECTED':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Ditolak</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(amount)
  }

  const formatPhoneNumber = (phone: string) => {
    return phone.replace(/(\d{4})(\d{4})(\d{4})/, '$1-$2-$3')
  }

  const hasActiveFilters = () => {
    return searchTerm !== '' ||
           rtFilter !== 'all' ||
           yearFilter !== new Date().getFullYear().toString() ||
           statusFilter !== '' && statusFilter !== 'ALL'
  }

  const clearFilters = () => {
    setSearchTerm('')
    setRtFilter('all')
    setYearFilter(new Date().getFullYear().toString())
    setStatusFilter('')
    setShowFilters(false)
  }

  if (loading && payments.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Manajemen Pembayaran</h1>
            <p className="text-muted-foreground">Kelola pembayaran IPL warga</p>
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manajemen Pembayaran</h1>
          <p className="text-muted-foreground mt-1">Kelola pembayaran IPL warga</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Tambah Pembayaran
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader className="pb-2">
              <DialogTitle>
                {editingPayment ? 'Edit Pembayaran' : 'Tambah Pembayaran Baru'}
              </DialogTitle>
              <DialogDescription>
                {editingPayment 
                  ? 'Edit informasi pembayaran yang sudah tercatat.'
                  : 'Catat pembayaran IPL baru dari warga.'
                }
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-3 py-2">
                <div className="grid grid-cols-4 items-center gap-3">
                  <Label htmlFor="residentId" className="text-right">
                    Warga
                  </Label>
                  <Select
                    value={formData.residentId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, residentId: value }))}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Pilih warga" />
                    </SelectTrigger>
                    <SelectContent>
                      {residents.map((resident) => (
                        <SelectItem key={resident.id} value={resident.id}>
                          {(resident.blok ? `${resident.blok} / ` : '')}{resident.houseNumber || ''} - {resident.name} - RT {resident.rt}/RW {resident.rw}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Period Selection Section */}
                <div className="grid grid-cols-4 items-start gap-3">
                  <Label className="text-right">
                    Pilih Periode
                  </Label>
                  <div className="col-span-3 space-y-2">
                    <p className="text-xs text-muted-foreground">Pilih periode pembayaran dari jadwal yang tersedia. Pembayaran akan otomatis ditautkan dengan item jadwal yang sesuai.</p>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm font-medium">Mulai bulan</Label>
                        <Select value={startIndex} onValueChange={setStartIndex} disabled={!formData.residentId}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder={formData.residentId ? "Pilih bulan mulai" : "Pilih warga terlebih dahulu"} />
                          </SelectTrigger>
                          <SelectContent>
                            {monthlyItems.map((it) => (
                              <SelectItem key={it.id} value={it.indexCode || it.period.name}>
                                {(it.indexCode || it.period.name) as string}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Jumlah bulan</Label>
                        <Input 
                          type="number" 
                          min={1} 
                          max={12} 
                          value={numMonths} 
                          onChange={(e) => setNumMonths(Math.max(1, parseInt(e.target.value) || 1))}
                          className="mt-1"
                          disabled={!formData.residentId}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preview Section - Full Width */}
                {startIndex && (
                  <div className="grid grid-cols-4 items-start gap-3">
                    <Label className="text-right">
                      Preview
                    </Label>
                    <div className="col-span-3">
                      <div className="p-3 bg-gray-50 rounded-lg border">
                        <Label className="text-sm font-medium mb-3 block">Periode yang akan dibayar:</Label>
                        <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto">
                          {monthlyItems.map((it) => {
                            const selected = consecutiveSelection.some(s => s.id === it.id)
                            const paid = it.status === 'PAID'
                            const isOverdue = it.dueDate && new Date(it.dueDate) < new Date()
                            return (
                              <span 
                                key={it.id} 
                                className={`px-3 py-1 text-sm rounded-md border flex-shrink-0 ${
                                  selected 
                                    ? 'bg-blue-100 border-blue-300 text-blue-800 font-medium' 
                                    : paid 
                                      ? 'bg-green-100 border-green-300 text-green-800' 
                                      : isOverdue
                                        ? 'bg-red-100 border-red-300 text-red-800'
                                        : 'bg-gray-100 border-gray-200 text-gray-600'
                                }`}
                              >
                                {(it.indexCode || it.period.name) as string}
                                {paid && ' ✓'}
                                {isOverdue && !paid && ' ⚠'}
                              </span>
                            )
                          })}
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          <span className="inline-flex items-center gap-1 mr-4">
                            <span className="w-3 h-3 bg-blue-100 border border-blue-300 rounded"></span>
                            Terpilih
                          </span>
                          <span className="inline-flex items-center gap-1 mr-4">
                            <span className="w-3 h-3 bg-green-100 border border-green-300 rounded"></span>
                            Sudah dibayar
                          </span>
                          <span className="inline-flex items-center gap-1 mr-4">
                            <span className="w-3 h-3 bg-red-100 border border-red-300 rounded"></span>
                            Terlambat
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span className="w-3 h-3 bg-gray-100 border border-gray-200 rounded"></span>
                            Belum dibayar
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Extra items: THR / Sumbangan */}
                <div className="grid grid-cols-4 items-start gap-3">
                  <Label className="text-right">
                    Pembayaran Tambahan
                  </Label>
                  <div className="col-span-3">
                    <p className="text-sm font-medium mb-2">THR & Sumbangan (Opsional)</p>
                    <p className="text-xs text-muted-foreground mb-3">Pilih item tambahan seperti THR atau sumbangan jika ingin dibayarkan bersamaan</p>
                    
                    {scheduleItems.filter(it => it.type !== 'MONTHLY').length > 0 ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {scheduleItems.filter(it => it.type !== 'MONTHLY').map((it) => {
                            const checked = selectedExtraIds.includes(it.id)
                            return (
                              <div key={it.id} className={`p-3 rounded-lg border cursor-pointer transition-colors ${checked ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                                <div className="flex items-start">
                                  <input
                                    type="checkbox"
                                    className="mt-1 mr-3"
                                    checked={checked}
                                    onChange={(e) => {
                                      setSelectedExtraIds(prev => e.target.checked ? [...prev, it.id] : prev.filter(id => id !== it.id))
                                    }}
                                  />
                                  <div className="flex-1">
                                    <div className="font-medium text-sm">{(it.indexCode || it.period.name) as string}</div>
                                    <div className="text-xs text-gray-600 mt-1">
                                      {it.type === 'SPECIAL' ? 'Pembayaran Khusus' : 'Sumbangan'}
                                    </div>
                                    <div className="font-semibold text-sm mt-1">
                                      {formatCurrency(it.amount)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-sm text-gray-600">Tidak ada pembayaran tambahan (THR/Sumbangan) yang tersedia untuk warga ini.</p>
                        <p className="text-xs text-gray-500 mt-1">Hubungi admin untuk menambahkan pembayaran tambahan jika diperlukan.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment Information */}
                {selectedAllItems.length > 0 && (
                  <div className="grid grid-cols-4 items-start gap-3">
                    <Label className="text-right">
                      Informasi
                    </Label>
                    <div className="col-span-3">
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <Label className="text-sm font-medium text-blue-900 mb-3 block">Informasi Pembayaran</Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-gray-600 block">Total period terpilih:</span>
                            <div className="font-semibold text-lg text-blue-900">{formatCurrency(suggestedTotal)}</div>
                          </div>
                          <div>
                            <span className="text-gray-600 block">Kode transfer (index bayar):</span>
                            <div className="font-semibold text-blue-900">{residentById[formData.residentId]?.paymentIndex ?? '-'}</div>
                          </div>
                          {selectedAllItems.length > 0 && residentById[formData.residentId]?.paymentIndex && (
                            <div className="md:col-span-2 p-3 bg-blue-100 rounded-md border border-blue-300">
                              <span className="text-blue-800 font-medium">
                                💡 Rekomendasi pembayaran: <b>{formatCurrency(suggestedTransferAmount)}</b> (total + index bayar)
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="mt-2 text-xs text-gray-500 italic">
                          Isi jumlah transfer secara manual sesuai slip bank. Sistem tetap mencatat per item.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-4 items-center gap-3">
                  <Label htmlFor="amount" className="text-right">
                    Jumlah Transfer
                  </Label>
                  <div className="col-span-3">
                    <div className="relative">
                      <Input
                        id="amount"
                        type="number"
                        value={formData.amount}
                        onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                        placeholder="Masukkan jumlah transfer sesuai slip bank"
                        required
                        className={selectedAllItems.length > 0 ? "pr-16" : ""}
                      />
                      {selectedAllItems.length > 0 && (
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                          <div className="w-2 h-2 bg-green-500 rounded-full" title="Terisi otomatis"></div>
                        </div>
                      )}
                    </div>
                    {selectedAllItems.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-medium text-green-700">
                          ✅ Terisi otomatis: {formatCurrency(suggestedTransferAmount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Jumlah ini sudah termasuk index bayar ({residentById[formData.residentId]?.paymentIndex || 0}).
                          Anda dapat mengubahnya manual jika diperlukan.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-3">
                  <Label htmlFor="paymentDate" className="text-right">
                    Tanggal
                  </Label>
                  <Input
                    id="paymentDate"
                    type="date"
                    value={formData.paymentDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, paymentDate: e.target.value }))}
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-3">
                  <Label htmlFor="paymentMethod" className="text-right">
                    Metode
                  </Label>
                  <Select
                    value={formData.paymentMethod}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, paymentMethod: value }))}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Pilih metode pembayaran" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Transfer Bank">Transfer Bank</SelectItem>
                      <SelectItem value="Tunai">Tunai</SelectItem>
                      <SelectItem value="E-Wallet">E-Wallet</SelectItem>
                      <SelectItem value="Lainnya">Lainnya</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-3">
                  <Label htmlFor="notes" className="text-right">
                    Catatan
                  </Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="col-span-3"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-4 items-start gap-3">
                  <Label className="text-right pt-2">
                    Bukti Transfer
                  </Label>
                  <div className="col-span-3 space-y-2">
                    {/* Show existing proofs when editing */}
                    {editingPayment && editingPayment.proofs && editingPayment.proofs.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Bukti transfer yang ada:</p>
                        {editingPayment.proofs.map((proof) => (
                          <div key={proof.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <div className="flex items-center gap-2">
                              <ImageIcon className="h-4 w-4" />
                              <span className="text-sm">{proof.filename}</span>
                              <span className="text-xs text-gray-500">
                                ({(proof.fileSize / 1024 / 1024).toFixed(2)} MB)
                              </span>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              Sudah tersimpan
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* File upload for new proofs */}
                    <Input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileChange}
                      className="cursor-pointer"
                    />
                    {selectedFiles.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">File baru yang dipilih:</p>
                        {selectedFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <div className="flex items-center gap-2">
                              <ImageIcon className="h-4 w-4" />
                              <span className="text-sm">{file.name}</span>
                              <span className="text-xs text-gray-500">
                                ({(file.size / 1024 / 1024).toFixed(2)} MB)
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {error && (
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Menyimpan...' : (editingPayment ? 'Update' : 'Simpan')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="card-hover border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Search className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
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
                placeholder="Cari nama warga atau catatan..."
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
                    <SelectValue placeholder="Filter RT" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua RT</SelectItem>
                    {Array.from(new Set(residents.map(r => r.rt))).sort((a, b) => a - b).map((rt) => (
                      <SelectItem key={rt} value={rt.toString()}>RT {rt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Year Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tahun</Label>
                <Select value={yearFilter} onValueChange={setYearFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter Tahun" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Tahun</SelectItem>
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

              {/* Status Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua Status</SelectItem>
                    <SelectItem value="PENDING">Menunggu Verifikasi</SelectItem>
                    <SelectItem value="VERIFIED">Terverifikasi</SelectItem>
                    <SelectItem value="REJECTED">Ditolak</SelectItem>
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
              
              {statusFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                  {statusFilter === 'PENDING' ? 'Menunggu Verifikasi' :
                   statusFilter === 'VERIFIED' ? 'Terverifikasi' :
                   statusFilter === 'REJECTED' ? 'Ditolak' : statusFilter}
                  <button onClick={() => setStatusFilter('ALL')} className="hover:text-orange-600">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card className="card-hover border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            Daftar Pembayaran
          </CardTitle>
          <CardDescription>
            Total {pagination.total} pembayaran tercatat
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium text-muted-foreground">
                Belum ada data pembayaran
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Mulai catat pembayaran IPL dari warga
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Warga</TableHead>
                    <TableHead>Periode</TableHead>
                    <TableHead>Jumlah</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Bukti</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{payment.resident.name}</div>
                          <div className="text-sm text-muted-foreground">
                            RT {payment.resident.rt}/RW {payment.resident.rw}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatPhoneNumber(payment.resident.phone)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          {payment.scheduleItems && payment.scheduleItems.length > 0 ? (
                            <div className="space-y-1">
                              {payment.scheduleItems.map((item, index) => (
                                <div key={item.id} className="flex items-center justify-between">
                                  <div className="font-medium text-sm">{item.period.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {formatCurrency(item.amount)}
                                  </div>
                                </div>
                              ))}
                              {payment.scheduleItems.length > 1 && (
                                <div className="text-xs text-blue-600 font-medium">
                                  Total: {formatCurrency(payment.scheduleItems.reduce((sum, item) => sum + item.amount, 0))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">Tidak ada periode</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(payment.amount)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-gray-400" />
                          <span className="text-sm">
                            {new Date(payment.paymentDate).toLocaleDateString('id-ID')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(payment.status)}</TableCell>
                      <TableCell>
                        {payment.proofs.length > 0 ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Badge variant="outline" className="cursor-pointer hover:bg-gray-100">
                                <ImageIcon className="w-3 h-3 mr-1" />
                                {payment.proofs.length} file
                              </Badge>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Bukti Transfer - {payment.resident.name}</DialogTitle>
                                <DialogDescription>
                                  Pembayaran IPL {payment.scheduleItems && payment.scheduleItems.length > 0 ? `${payment.scheduleItems.length} periode` : 'Tidak ada periode'} • {formatCurrency(payment.amount)}
                                </DialogDescription>
                              </DialogHeader>
                              <PaymentProofViewer
                                proofs={payment.proofs}
                                onAnalyze={handleAnalyzeProof}
                                onVerifyPayment={handleVerifyPayment}
                                paymentId={payment.id}
                              />
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <span className="text-muted-foreground text-sm">Tidak ada</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(payment.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="mt-6">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => handlePageChange(pagination.page - 1)}
                          className={pagination.page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => handlePageChange(page)}
                            isActive={pagination.page === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => handlePageChange(pagination.page + 1)}
                          className={pagination.page === pagination.totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
