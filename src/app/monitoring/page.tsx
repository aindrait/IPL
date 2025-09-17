'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  BarChart3,
  Calendar,
  Users,
  DollarSign,
  RefreshCw,
  Download,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Minus,
  AlertTriangle
} from 'lucide-react'

interface MonthData {
  scheduled: boolean
  paid: boolean
  amount: number
  paymentDate?: string
  daysOverdue?: number
  status: 'paid' | 'overdue' | 'scheduled' | 'unscheduled' | 'pending' | 'skipped'
  scheduleItemId?: string
  paymentId?: string
}

interface ResidentMonitoring {
  id: string
  name: string
  blok: string
  houseNumber: string
  rt: number
  months: Record<string, MonthData>
  totalPaid: number
  totalScheduled: number
  paymentRate: number
}

interface MonitoringData {
  filters: {
    rt: number | 'all'
    year: number
  }
  residents: ResidentMonitoring[]
  summary: {
    totalResidents: number
    totalPaid: number
    totalScheduled: number
    collectionRate: number
  }
  availableYears: number[]
  availableRTs: number[]
  metadata: {
    monthNames: string[]
    generatedAt: string
  }
}

const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'thr']

export default function MonitoringPage() {
  const [user, setUser] = useState<any>(null)
  const [data, setData] = useState<MonitoringData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [rtFilter, setRtFilter] = useState<string>('all')
  const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear())
  const router = useRouter()

  useEffect(() => {
    // Check if user is logged in
    const userData = localStorage.getItem('user')
    if (userData) {
      setUser(JSON.parse(userData))
    } else {
      router.push('/login')
      return
    }
    
    fetchMonitoringData()
  }, [router])

  const fetchMonitoringData = async (rt: string = rtFilter, year: number = yearFilter) => {
    try {
      setRefreshing(true)
      const params = new URLSearchParams()
      if (rt !== 'all') params.append('rt', rt)
      params.append('year', year.toString())

      const response = await fetch(`/api/monitoring?${params.toString()}`)
      if (!response.ok) throw new Error('Gagal mengambil data monitoring')
      
      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error('Error fetching monitoring data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleFilterChange = (newRt?: string, newYear?: number) => {
    const rt = newRt ?? rtFilter
    const year = newYear ?? yearFilter
    
    if (newRt !== undefined) setRtFilter(newRt)
    if (newYear !== undefined) setYearFilter(newYear)
    
    fetchMonitoringData(rt, year)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const getStatusIcon = (monthData: MonthData) => {
    switch (monthData.status) {
      case 'paid':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'overdue':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'pending':
        return <AlertTriangle className="h-4 w-4 text-blue-600" />
      case 'scheduled':
        return <Clock className="h-4 w-4 text-yellow-600" />
      case 'skipped':
        return <Minus className="h-4 w-4 text-orange-600" />
      case 'unscheduled':
      default:
        return <Minus className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusColor = (monthData: MonthData) => {
    switch (monthData.status) {
      case 'paid':
        return 'bg-green-100 border-green-300 text-green-800'
      case 'overdue':
        return 'bg-red-100 border-red-300 text-red-800'
      case 'pending':
        return 'bg-blue-100 border-blue-300 text-blue-800'
      case 'scheduled':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800'
      case 'skipped':
        return 'bg-orange-100 border-orange-300 text-orange-800'
      case 'unscheduled':
      default:
        return 'bg-gray-50 border-gray-200 text-gray-500'
    }
  }

  const getTooltipContent = (monthData: MonthData, monthName: string) => {
    if (!monthData.scheduled) {
      return `${monthName}: Belum dijadwalkan`
    }

    let content = `${monthName}: ${formatCurrency(monthData.amount)}`
    
    if (monthData.status === 'skipped') {
      content += `\nStatus: Dilewati`
    } else if (monthData.paid && monthData.paymentDate) {
      content += `\nDibayar: ${monthData.paymentDate}`
    } else if (monthData.daysOverdue && monthData.daysOverdue > 0) {
      content += `\nTerlambat: ${monthData.daysOverdue} hari`
    }

    return content
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Gagal memuat data monitoring. Silakan coba lagi.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Monitoring
            </h1>
            <p className="text-muted-foreground">
              Monitor jadwal pembayaran vs realisasi per RT dan tahun
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={() => fetchMonitoringData()}
              disabled={refreshing}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filter Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">RT</label>
                <Select value={rtFilter} onValueChange={(value) => handleFilterChange(value, undefined)}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Pilih RT" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua RT</SelectItem>
                    {data.availableRTs.map((rt) => (
                      <SelectItem key={rt} value={rt.toString()}>
                        RT {rt.toString().padStart(2, '0')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Tahun</label>
                <Select value={yearFilter.toString()} onValueChange={(value) => handleFilterChange(undefined, parseInt(value))}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Pilih Tahun" />
                  </SelectTrigger>
                  <SelectContent>
                    {data.availableYears.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Badge variant="secondary" className="text-sm">
                  {data.filters.rt === 'all' ? 'Semua RT' : `RT ${data.filters.rt.toString().padStart(2, '0')}`} • 
                  Tahun {data.filters.year}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Statistics */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Warga</p>
                  <p className="text-2xl font-bold">{data.summary.totalResidents}</p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Terkumpul</p>
                  <p className="text-2xl font-bold">{formatCurrency(data.summary.totalPaid)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Target</p>
                  <p className="text-2xl font-bold">{formatCurrency(data.summary.totalScheduled)}</p>
                </div>
                <Calendar className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tingkat Pencapaian</p>
                  <p className="text-2xl font-bold">{data.summary.collectionRate}%</p>
                </div>
                <BarChart3 className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monitoring Table */}
        <Card>
          <CardHeader>
            <CardTitle>Monitoring Schedule vs Payment</CardTitle>
            <CardDescription>
              Status pembayaran per warga dan bulan. Klik cell untuk detail.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-48">Warga</TableHead>
                    {data.metadata.monthNames.map((month, index) => (
                      <TableHead key={MONTH_KEYS[index]} className="text-center min-w-20">
                        {month.slice(0, 3)}
                      </TableHead>
                    ))}
                    <TableHead className="text-center min-w-20">THR</TableHead>
                    <TableHead className="text-center min-w-24">Total</TableHead>
                    <TableHead className="text-center min-w-20">Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.residents.map((resident) => (
                    <TableRow key={resident.id}>
                      <TableCell className="font-medium">
                        <div>
                          <div className="font-semibold">{resident.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {resident.blok && resident.houseNumber 
                              ? `${resident.blok}/${resident.houseNumber}` 
                              : `RT ${resident.rt.toString().padStart(2, '0')}`}
                          </div>
                        </div>
                      </TableCell>
                      
                      {MONTH_KEYS.map((monthKey, index) => {
                        const monthData = resident.months[monthKey]
                        const monthName = monthKey === 'thr' ? 'THR' : data.metadata.monthNames[index]
                        
                        return (
                          <TableCell key={monthKey} className="text-center p-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div 
                                  className={`
                                    w-12 h-12 rounded-lg border-2 flex items-center justify-center cursor-pointer
                                    hover:shadow-md transition-all duration-200
                                    ${getStatusColor(monthData)}
                                  `}
                                >
                                  {getStatusIcon(monthData)}
                                  {monthData.paid && monthData.paymentDate && (
                                    <div className="text-xs mt-1 leading-none">
                                      {monthData.paymentDate.split('/')[0]}/{monthData.paymentDate.split('/')[1]}
                                    </div>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-sm whitespace-pre-line">
                                  {getTooltipContent(monthData, monthName)}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                        )
                      })}
                      
                      <TableCell className="text-center font-medium">
                        <div className="text-sm">
                          {formatCurrency(resident.totalPaid)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          / {formatCurrency(resident.totalScheduled)}
                        </div>
                      </TableCell>
                      
                      <TableCell className="text-center">
                        <Badge 
                          variant={resident.paymentRate >= 80 ? "default" : resident.paymentRate >= 50 ? "secondary" : "destructive"}
                        >
                          {resident.paymentRate}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Legend */}
        <Card>
          <CardHeader>
            <CardTitle>Keterangan Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded border-2 bg-green-100 border-green-300 flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <span className="text-sm">Sudah Dibayar</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded border-2 bg-red-100 border-red-300 flex items-center justify-center">
                  <XCircle className="h-4 w-4 text-red-600" />
                </div>
                <span className="text-sm">Terlambat</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded border-2 bg-blue-100 border-blue-300 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-blue-600" />
                </div>
                <span className="text-sm">Menunggu Verifikasi</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded border-2 bg-yellow-100 border-yellow-300 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-yellow-600" />
                </div>
                <span className="text-sm">Dijadwalkan</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded border-2 bg-orange-100 border-orange-300 flex items-center justify-center">
                  <Minus className="h-4 w-4 text-orange-600" />
                </div>
                <span className="text-sm">Dilewati</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded border-2 bg-gray-50 border-gray-200 flex items-center justify-center">
                  <Minus className="h-4 w-4 text-gray-400" />
                </div>
                <span className="text-sm">Belum Dijadwalkan</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
