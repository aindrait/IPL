'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  TrendingUp,
  Users,
  DollarSign,
  Calendar,
  Search
} from 'lucide-react'

interface UploadResult {
  batchId: string
  totalTransactions: number
  validTransactions: number
  autoMatched: number
  needsReview: number
  importedHistory: number
  errors: string[]
}

interface ProcessingStats {
  totalUploaded: number
  totalMatched: number
  totalVerified: number
  totalAmount: number
  lastUpload?: string
}

interface MutationItem {
  id: string
  transactionDate: string
  description: string
  amount: number
  balance?: number | null
  referenceNumber?: string | null
  transactionType?: 'CR' | 'DB' | null
  category?: string | null
  isOmitted: boolean
  omitReason?: string | null
  isVerified: boolean
  verifiedAt?: string | null
  verifiedBy?: string | null
  matchedPaymentId?: string | null
  matchedResidentId?: string | null
  matchScore?: number | null
  matchingStrategy?: string | null
  uploadBatch: string
  fileName?: string | null
  createdAt: string
  residentName?: string | null
  residentBlok?: string | null
  residentHouseNumber?: string | null
}

export default function BankMutationsPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState('')
  const [deleteExistingData, setDeleteExistingData] = useState(true)
  const [existingDataCheck, setExistingDataCheck] = useState<{ hasData: boolean; count: number } | null>(null)
  const [stats, setStats] = useState<ProcessingStats>({
    totalUploaded: 0,
    totalMatched: 0,
    totalVerified: 0,
    totalAmount: 0
  })

  // Listing state
  const now = useMemo(() => new Date(), [])
  const [tab, setTab] = useState<'upload' | 'verify' | 'history'>('upload')
  const [year, setYear] = useState<string>(String(now.getFullYear()))
  const [month, setMonth] = useState<string>(String(now.getMonth() + 1).padStart(2, '0'))
  const [verifiedFilter, setVerifiedFilter] = useState<'all' | 'true' | 'false'>('all')
  const [matchedFilter, setMatchedFilter] = useState<'all' | 'true' | 'false'>('all')
  const [omittedFilter, setOmittedFilter] = useState<'all' | 'true' | 'false'>('false')
  const [search, setSearch] = useState<string>('')
  const [listLoading, setListLoading] = useState<boolean>(false)
  const [items, setItems] = useState<MutationItem[]>([])
  const [total, setTotal] = useState<number>(0)
  const [page, setPage] = useState<number>(1)
  const [limit] = useState<number>(20)
  const [autoVerifying, setAutoVerifying] = useState(false)
  const [residents, setResidents] = useState<Array<{id:string; name:string; blok?:string; houseNumber?:string}>>([])
  const [residentsLoading, setResidentsLoading] = useState(false)
  const [residentSearch, setResidentSearch] = useState('')
  const [finderDialogOpen, setFinderDialogOpen] = useState(false)
  const [selectedResident, setSelectedResident] = useState<{id:string; name:string; blok?:string; houseNumber?:string} | null>(null)
  const [currentMutationId, setCurrentMutationId] = useState<string | null>(null)

  const loadResidents = async (searchTerm = '') => {
    setResidentsLoading(true)
    try {
      const url = searchTerm
        ? `/api/residents?limit=100&search=${encodeURIComponent(searchTerm)}`
        : `/api/residents?limit=100`
      const response = await fetch(url)
      const data = await response.json()
      const list = (data.residents || []).map((x: any) => ({
        id: x.id,
        name: x.name,
        blok: x.blok,
        houseNumber: x.houseNumber
      }))
      setResidents(list)
    } catch (error) {
      console.error('Failed to load residents:', error)
    } finally {
      setResidentsLoading(false)
    }
  }

  useEffect(() => {
    // Preload minimal resident list for manual match picker
    loadResidents()
  }, [])

  useEffect(() => {
    if (residentSearch) {
      const timeoutId = setTimeout(() => {
        loadResidents(residentSearch)
      }, 300)
      return () => clearTimeout(timeoutId)
    } else {
      loadResidents()
    }
  }, [residentSearch])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Validate file type
      const validTypes = ['text/csv']

      if (!validTypes.includes(file.type) && !file.name.match(/\.(csv)$/i)) {
        setError('Please select a CSV file')
        return
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB')
        return
      }
      
      setSelectedFile(file)
      setError('')
      setUploadResult(null)
    }
  }

  // Check for existing data in the selected period
  const checkExistingData = async () => {
    try {
      const response = await fetch(`/api/bank-mutations/check-period?year=${year}&month=${month}`)
      if (response.ok) {
        const data = await response.json()
        setExistingDataCheck(data)
      }
    } catch (error) {
      console.error('Failed to check existing data:', error)
    }
  }

  // Check for existing data when month/year changes
  useEffect(() => {
    if (year && month) {
      checkExistingData()
    }
  }, [year, month])

  const handleUpload = async () => {
    if (!selectedFile) return

    // Show confirmation if there's existing data and delete option is not selected
    if (existingDataCheck?.hasData && !deleteExistingData) {
      if (!confirm(`Ditemukan ${existingDataCheck.count} transaksi untuk periode ${month}/${year}. Upload baru akan membuat data duplikat. Lanjutkan?`)) {
        return
      }
    }

    setUploading(true)
    setUploadProgress(0)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      // pass month/year hints for date parsing
      formData.append('hintYear', year)
      formData.append('forceMonth', String(parseInt(month, 10)))
      formData.append('deleteExisting', String(deleteExistingData))
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      const response = await fetch('/api/bank-mutations/upload', {
        method: 'POST',
        body: formData
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const result: UploadResult = await response.json()
      setUploadResult(result)
      
      // Reset existing data check
      setExistingDataCheck(null)
      
      // Refresh stats
      fetchStats()
      // Load verify list for current month/year
      setTab('verify')
      setPage(1)
      await fetchList(1)
      
    } catch (error) {
      console.error('Upload error:', error)
      setError(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setUploading(false)
      setTimeout(() => setUploadProgress(0), 2000)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/bank-mutations/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const fetchList = async (targetPage = page) => {
    try {
      setListLoading(true)
      const params = new URLSearchParams()
      params.set('page', String(targetPage))
      params.set('limit', String(limit))
      if (year) params.set('year', year)
      if (month) params.set('month', month)
      if (verifiedFilter !== 'all') params.set('verified', verifiedFilter)
      if (matchedFilter !== 'all') params.set('matched', matchedFilter)
      if (omittedFilter !== 'all') params.set('omitted', omittedFilter)
      if (search.trim()) params.set('search', search.trim())

      const resp = await fetch(`/api/bank-mutations?${params.toString()}`)
      if (resp.ok) {
        const data = await resp.json()
        setItems(data.items || [])
        setTotal(data.total || 0)
        setPage(data.page || targetPage)
      }
    } catch (e) {
      console.error('Failed to fetch list:', e)
    } finally {
      setListLoading(false)
    }
  }

  useEffect(() => {
    // Initial load stats and list
    fetchStats()
    fetchList(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bank Mutation Verification</h1>
        <p className="text-muted-foreground">
          Upload bank mutation files to automatically verify IPL payments
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Uploaded</p>
                <p className="text-2xl font-bold">{stats.totalUploaded}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Auto Matched</p>
                <p className="text-2xl font-bold">{stats.totalMatched}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Verified</p>
                <p className="text-2xl font-bold">{stats.totalVerified}</p>
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
                <p className="text-lg font-bold">{formatCurrency(stats.totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="upload">Upload Mutations</TabsTrigger>
          <TabsTrigger value="verify">Verify Matches</TabsTrigger>
          <TabsTrigger value="history">Upload History</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          {/* Upload Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Bank Mutation File
              </CardTitle>
              <CardDescription>
                Upload CSV file with Indonesian bank mutation format. 
                Supports both raw bank data (columns A-F) and complete verification history (columns A-O).
                Expected format: Tanggal, Keterangan, Cabang, Jumlah, [blank], Saldo, [verification columns G-O if available]
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Month/Year Hints */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label>Month (hint)</Label>
                  <select value={month} onChange={(e) => setMonth(e.target.value)} className="w-full border rounded h-9 px-2">
                    {Array.from({ length: 12 }).map((_, i) => {
                      const m = String(i + 1).padStart(2, '0')
                      return <option key={m} value={m}>{m}</option>
                    })}
                  </select>
                </div>
                <div>
                  <Label>Year (hint)</Label>
                  <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="2025" />
                </div>
              </div>
              
              {/* Duplicate Data Prevention */}
              <div className="space-y-3 border rounded p-4 bg-muted/50">
                <div className="flex items-center space-x-2">
                  <input
                    id="delete-existing"
                    type="checkbox"
                    checked={deleteExistingData}
                    onChange={(e) => setDeleteExistingData(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="delete-existing" className="text-sm font-medium">
                    Hapus data periode ini sebelum upload
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Mencegah duplikasi data dengan menghapus semua transaksi bank untuk bulan {month}/{year} sebelum mengupload data baru.
                </p>
                
                {existingDataCheck && existingDataCheck.hasData && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Ditemukan {existingDataCheck.count} transaksi untuk periode {month}/{year}.
                      {deleteExistingData
                        ? " Data ini akan dihapus sebelum upload baru."
                        : " Upload baru akan menambah data duplikat."}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="file">Select File</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="cursor-pointer"
                />
                {selectedFile && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>{selectedFile.name}</span>
                    <span>({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                )}
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {uploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Processing file...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="w-full" />
                </div>
              )}

              <Button 
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="w-full"
              >
                {uploading ? 'Processing...' : 'Upload and Process'}
              </Button>
            </CardContent>
          </Card>

          {/* Upload Result */}
          {uploadResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Upload Complete
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{uploadResult.totalTransactions}</p>
                    <p className="text-sm text-muted-foreground">Total Transactions</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{uploadResult.validTransactions}</p>
                    <p className="text-sm text-muted-foreground">Valid</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{uploadResult.autoMatched}</p>
                    <p className="text-sm text-muted-foreground">Auto Matched</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-600">{uploadResult.needsReview}</p>
                    <p className="text-sm text-muted-foreground">Needs Review</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-600">{uploadResult.importedHistory}</p>
                    <p className="text-sm text-muted-foreground">History Imported</p>
                  </div>
                </div>

                {uploadResult.errors.length > 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <p className="font-medium">Parsing Errors:</p>
                        <ul className="list-disc list-inside text-sm">
                          {uploadResult.errors.slice(0, 5).map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                          {uploadResult.errors.length > 5 && (
                            <li>... and {uploadResult.errors.length - 5} more errors</li>
                          )}
                        </ul>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2 mt-4">
                  <Button 
                    onClick={() => window.location.href = '/bank-mutations?tab=verify'}
                    className="flex-1"
                  >
                    Review Matches
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setSelectedFile(null)
                      setUploadResult(null)
                    }}
                  >
                    Upload Another File
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="verify">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Bank Verification</h1>
              <p className="text-muted-foreground">Review and verify matched transactions by period</p>
            </div>
          </div>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Manual Verification</CardTitle>
              <CardDescription>Review and verify matched transactions by period</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <div>
                  <Label>Month</Label>
                  <select value={month} onChange={(e) => setMonth(e.target.value)} className="w-full border rounded h-9 px-2">
                    {Array.from({ length: 12 }).map((_, i) => {
                      const m = String(i + 1).padStart(2, '0')
                      return <option key={m} value={m}>{m}</option>
                    })}
                  </select>
                </div>
                <div>
                  <Label>Year</Label>
                  <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="2025" />
                </div>
                <div>
                  <Label>Verified</Label>
                  <select value={verifiedFilter} onChange={(e) => setVerifiedFilter(e.target.value as any)} className="w-full border rounded h-9 px-2">
                    <option value="all">All</option>
                    <option value="true">Verified</option>
                    <option value="false">Unverified</option>
                  </select>
                </div>
                <div>
                  <Label>Matched</Label>
                  <select value={matchedFilter} onChange={(e) => setMatchedFilter(e.target.value as any)} className="w-full border rounded h-9 px-2">
                    <option value="all">All</option>
                    <option value="true">Matched</option>
                    <option value="false">Unmatched</option>
                  </select>
                </div>
                <div>
                  <Label>Show Omitted</Label>
                  <select value={omittedFilter} onChange={(e) => setOmittedFilter(e.target.value as any)} className="w-full border rounded h-9 px-2">
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                    <option value="all">All</option>
                  </select>
                </div>
                <div>
                  <Label>Search</Label>
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="description/ref/batch" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => { setPage(1); fetchList(1) }} disabled={listLoading}>Apply Filters</Button>
                <Button variant="outline" onClick={() => { setYear(String(now.getFullYear())); setMonth(String(now.getMonth() + 1).padStart(2, '0')); setVerifiedFilter('all'); setMatchedFilter('all'); setSearch(''); setPage(1); fetchList(1) }} disabled={listLoading}>Reset</Button>
                <Button
                  variant="secondary"
                  disabled={listLoading}
                  onClick={async () => {
                    try {
                      setAutoVerifying(true)
                      const res = await fetch('/api/bank-mutations/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          year: parseInt(year, 10),
                          month: parseInt(month, 10),
                        })
                      })
                      if (!res.ok) throw new Error('Auto verify failed')
                      await fetchList(1)
                    } catch (e) {
                      console.error(e)
                      alert('Auto verify failed')
                    } finally { setAutoVerifying(false) }
                  }}
                >
                  {autoVerifying ? 'Auto Verifying...' : 'Auto Verify (Index + Fuzzy)'}
                </Button>
                <Button
                  variant="default"
                  disabled={listLoading}
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/bank-mutations/match-api', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          year: parseInt(year, 10),
                          month: parseInt(month, 10),
                        })
                      })
                      if (!res.ok) throw new Error('Match via API failed')
                      await fetchList(1)
                    } catch (e) {
                      console.error(e)
                      alert('Match via API failed')
                    }
                  }}
                >
                  Match via API
                </Button>
              </div>

              {/* List */}
              <div className="border rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Resident</TableHead>
                      <TableHead>Match</TableHead>
                      <TableHead>Verified</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listLoading && (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <div className="text-center text-sm text-muted-foreground py-6">Loading...</div>
                        </TableCell>
                      </TableRow>
                    )}
                    {!listLoading && items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <div className="text-center text-sm text-muted-foreground py-6">No data</div>
                        </TableCell>
                      </TableRow>
                    )}
                    {!listLoading && items.map((it) => {
                      const dateStr = new Date(it.transactionDate).toLocaleDateString('id-ID')
                      const resident = it.residentName ? `${it.residentName}${it.residentBlok ? ` (${it.residentBlok}${it.residentHouseNumber ? `/${it.residentHouseNumber}` : ''})` : ''}` : '-'
                      
                      // Skip omitted transactions based on filter
                      if (it.isOmitted && omittedFilter === 'false') {
                        return null
                      }
                      
                      return (
                        <TableRow key={it.id} className={`${!it.isVerified ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''} ${it.isOmitted ? 'bg-gray-100 dark:bg-gray-800/50' : ''}`}>
                          <TableCell>{dateStr}</TableCell>
                          <TableCell className="max-w-[600px] truncate" title={it.description}>{it.description}</TableCell>
                          <TableCell className="text-right">{formatCurrency(it.amount)}</TableCell>
                          <TableCell>
                            {it.transactionType && (
                              <Badge variant={it.transactionType === 'CR' ? 'default' : 'secondary'}>
                                {it.transactionType}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {it.category && (
                              <Badge variant={
                                it.category === 'IPL' ? 'default' :
                                it.category === 'THR' ? 'secondary' :
                                it.category === 'SUMBANGAN' ? 'outline' :
                                'destructive'
                              }>
                                {it.category}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{resident}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm">
                              <Badge variant={it.matchedResidentId ? 'default' : 'secondary'}>
                                {it.matchedResidentId ? 'Matched' : 'Unmatched'}
                              </Badge>
                              {typeof it.matchScore === 'number' && (
                                <span className="text-muted-foreground">{Math.round(it.matchScore * 100)}%</span>
                              )}
                              {it.matchingStrategy && (
                                <span className="text-xs text-muted-foreground">{it.matchingStrategy}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {it.isVerified ? (
                              <div className="flex items-center gap-2">
                                <Badge variant={'default'}>Verified</Badge>
                                {it.verifiedBy !== 'OMITTED' && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={async () => {
                                        try {
                                          const res = await fetch(`/api/bank-mutations/edit/${it.id}`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ action: 'unverify' })
                                          })
                                          const data = await res.json()
                                          if (!res.ok) throw new Error(data.error || 'Unverify failed')
                                          await fetchList(page)
                                        } catch (e) {
                                          console.error(e)
                                          alert(e instanceof Error ? e.message : 'Unverify failed')
                                        }
                                      }}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={async () => {
                                        const reason = prompt('Alasan menghilangkan transaksi ini:')
                                        if (!reason) return
                                        
                                        try {
                                          const res = await fetch(`/api/bank-mutations/omit/${it.id}`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ omitReason: reason })
                                          })
                                          const data = await res.json()
                                          if (!res.ok) throw new Error(data.error || 'Omit failed')
                                          await fetchList(page)
                                        } catch (e) {
                                          console.error(e)
                                          alert(e instanceof Error ? e.message : 'Omit failed')
                                        }
                                      }}
                                    >
                                      Omit
                                    </Button>
                                  </>
                                )}
                                {it.verifiedBy === 'OMITTED' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={async () => {
                                      try {
                                        const res = await fetch(`/api/bank-mutations/restore/${it.id}`, {
                                          method: 'POST'
                                        })
                                        const data = await res.json()
                                        if (!res.ok) throw new Error(data.error || 'Restore failed')
                                        await fetchList(page)
                                      } catch (e) {
                                        console.error(e)
                                        alert(e instanceof Error ? e.message : 'Restore failed')
                                      }
                                    }}
                                  >
                                    Restore
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Badge variant={'secondary'}>Pending</Badge>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    // Check if house number is filled
                                    if (!it.residentHouseNumber) {
                                      alert('Harap isi nomor rumah terlebih dahulu melalui manual matching sebelum verifikasi')
                                      return
                                    }
                                    
                                    try {
                                      const res = await fetch(`/api/bank-mutations/verify/${it.id}`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ verifiedBy: 'USER' })
                                      })
                                      const data = await res.json()
                                      if (!res.ok) throw new Error(data.error || 'Verify failed')
                                      await fetchList(page)
                                    } catch (e) {
                                      console.error(e)
                                      alert(e instanceof Error ? e.message : 'Verify failed')
                                    }
                                  }}
                                  disabled={!it.residentHouseNumber}
                                  title={!it.residentHouseNumber ? "Isi nomor rumah melalui manual matching terlebih dahulu" : ""}
                                >
                                  Verify
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={async () => {
                                    const reason = prompt('Alasan menghilangkan transaksi ini:')
                                    if (!reason) return
                                    
                                    try {
                                      const res = await fetch(`/api/bank-mutations/omit/${it.id}`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ omitReason: reason })
                                      })
                                      const data = await res.json()
                                      if (!res.ok) throw new Error(data.error || 'Omit failed')
                                      await fetchList(page)
                                    } catch (e) {
                                      console.error(e)
                                      alert(e instanceof Error ? e.message : 'Omit failed')
                                    }
                                  }}
                                >
                                  Omit
                                </Button>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button size="sm" variant="secondary">Manual</Button>
                                  </DialogTrigger>
                                  <DialogContent className="sm:max-w-[600px] bg-card border shadow-lg">
                                    <DialogHeader>
                                      <DialogTitle>Manual Match</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 py-2">
                                      <div className="space-y-2">
                                        <Label>Resident</Label>
                                        <div className="flex gap-2">
                                          <Input
                                            placeholder="Click to select resident..."
                                            value={selectedResident?.name || ''}
                                            readOnly
                                            onClick={() => {
                                              setCurrentMutationId(it.id)
                                              setFinderDialogOpen(true)
                                            }}
                                            className="cursor-pointer"
                                          />
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                              setCurrentMutationId(it.id)
                                              setFinderDialogOpen(true)
                                            }}
                                          >
                                            <Search className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                      
                                      <Input id={`resident-${it.id}`} type="hidden" value={selectedResident?.id || ''} />
                                      
                                      <div className="space-y-2">
                                        <Label>Payment ID (optional)</Label>
                                        <Input id={`payment-${it.id}`} placeholder="payment-id" />
                                      </div>
                                      
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <input id={`verify-${it.id}`} type="checkbox" className="h-4 w-4" />
                                        <label htmlFor={`verify-${it.id}`}>Verify now</label>
                                      </div>
                                    </div>
                                    <DialogFooter>
                                      <Button
                                        onClick={async () => {
                                          try {
                                            const residentInput = (document.getElementById(`resident-${it.id}`) as HTMLInputElement)?.value
                                            const paymentInput = (document.getElementById(`payment-${it.id}`) as HTMLInputElement)?.value
                                            const verifyNow = (document.getElementById(`verify-${it.id}`) as HTMLInputElement)?.checked
                                            if (!residentInput) {
                                              alert('Please select a resident first')
                                              return
                                            }
                                            const res = await fetch(`/api/bank-mutations/match-manual/${it.id}`, {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({ residentId: residentInput, paymentId: paymentInput || undefined, verified: Boolean(verifyNow) })
                                            })
                                            const data = await res.json()
                                            if (!res.ok) throw new Error(data.error || 'Manual match failed')
                                            await fetchList(page)
                                            setSelectedResident(null)
                                          } catch (e) {
                                            console.error(e)
                                            alert(e instanceof Error ? e.message : 'Manual match failed')
                                          }
                                        }}
                                        disabled={!selectedResident}
                                      >
                                        Save
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>

                                {/* Resident Finder Dialog */}
                                <Dialog open={finderDialogOpen} onOpenChange={setFinderDialogOpen}>
                                  <DialogContent className="sm:max-w-[500px] bg-card border shadow-lg">
                                    <DialogHeader>
                                      <DialogTitle>Find Resident</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 py-2">
                                      <div className="relative">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                                        <Input
                                          placeholder="Search by name, address, phone, block, or house number..."
                                          value={residentSearch}
                                          onChange={(e) => setResidentSearch(e.target.value)}
                                          className="pl-10"
                                        />
                                      </div>
                                      
                                      <div className="max-h-64 overflow-y-auto border rounded-md">
                                        {residentsLoading ? (
                                          <div className="p-4 text-center text-muted-foreground">Loading residents...</div>
                                        ) : residents.length === 0 ? (
                                          <div className="p-4 text-center text-muted-foreground">No residents found</div>
                                        ) : (
                                          residents.map((resident) => (
                                            <div
                                              key={resident.id}
                                              className="p-3 hover:bg-accent cursor-pointer border-b last:border-b-0 transition-colors"
                                              onClick={() => {
                                                setSelectedResident(resident)
                                                setFinderDialogOpen(false)
                                                setResidentSearch('')
                                                if (currentMutationId) {
                                                  const el = document.getElementById(`resident-${currentMutationId}`) as HTMLInputElement
                                                  if (el) el.value = resident.id
                                                }
                                              }}
                                            >
                                              <div className="font-medium">{resident.name}</div>
                                              {resident.blok && resident.houseNumber && (
                                                <div className="text-sm text-muted-foreground">
                                                  {resident.blok} {resident.houseNumber}
                                                </div>
                                              )}
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    </div>
                                    <DialogFooter>
                                      <Button variant="outline" onClick={() => setFinderDialogOpen(false)}>
                                        Cancel
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between text-sm">
                <div className="text-muted-foreground">Total: {total}</div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" disabled={page <= 1 || listLoading} onClick={() => { const p = page - 1; setPage(p); fetchList(p) }}>Prev</Button>
                  <div>Page {page}</div>
                  <Button variant="outline" disabled={page * limit >= total || listLoading} onClick={() => { const p = page + 1; setPage(p); fetchList(p) }}>Next</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Upload History</CardTitle>
              <CardDescription>
                View previous uploads and their processing status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Use this to clear bank mutation data</div>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    try {
                      if (!confirm('Clear all bank mutation data? This cannot be undone.')) return
                      const resp = await fetch('/api/bank-mutations', { method: 'DELETE' })
                      if (!resp.ok) throw new Error('Failed to reset')
                      await fetchStats()
                      await fetchList(1)
                    } catch (e) {
                      console.error(e)
                      alert('Reset failed')
                    }
                  }}
                >
                  Clear All Data
                </Button>
              </div>

              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4" />
                <p>Upload history will be displayed here</p>
                <p className="text-sm">Track all your previous mutation uploads</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
