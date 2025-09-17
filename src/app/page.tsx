'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Users,
  DollarSign,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  Download,
  Plus,
  MessageSquare,
  Image as ImageIcon,
  FileImage,
  Settings,
  RefreshCw
} from 'lucide-react'
import Link from 'next/link'

interface DashboardStats {
  totalResidents: number
  totalPaid: number
  totalPending: number
  totalOverdue: number
  collectionRate: number
  currentPeriod: {
    name: string
    month: number
    year: number
    amount: number
    dueDate: string
  }
}

interface PaymentSettings {
  defaultAmount: number
  dueDate: number
  rwSettings: {
    activeRWs: number[]
    defaultRW: number
  }
}

interface RecentPayment {
  id: string
  residentName: string
  amount: number
  paymentDate: string
  status: string
  period: string
  hasProof: boolean
}

interface UnpaidResident {
  id: string
  name: string
  address: string
  phone: string
  daysOverdue: number
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([])
  const [unpaidResidents, setUnpaidResidents] = useState<UnpaidResident[]>([])
  const [totalIncome, setTotalIncome] = useState<number>(0)
  const [totalProofs, setTotalProofs] = useState<number>(0)
  const [overdueByRT, setOverdueByRT] = useState<any[]>([])
  const [overdueByRW, setOverdueByRW] = useState<any[]>([])
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [creatingSample, setCreatingSample] = useState(false)
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
    
    fetchDashboardData()
  }, [router])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/dashboard')
      if (!response.ok) throw new Error('Gagal mengambil data dashboard')
      
      const data = await response.json()
      
      setStats(data.stats)
      setRecentPayments(data.recentPayments)
      setUnpaidResidents(data.unpaidResidents)
      setTotalIncome(data.totalIncome)
      setTotalProofs(data.totalProofs)
      setOverdueByRT(data.overdueByRT || [])
      setOverdueByRW(data.overdueByRW || [])
      setPaymentSettings(data.paymentSettings || null)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      // Fallback to mock data if API fails
      const mockStats: DashboardStats = {
        totalResidents: 0,
        totalPaid: 0,
        totalPending: 0,
        totalOverdue: 0,
        collectionRate: 0,
        currentPeriod: {
          name: "Tidak ada periode aktif",
          month: 0,
          year: 0,
          amount: 0,
          dueDate: new Date().toISOString().split('T')[0]
        }
      }

      const mockPaymentSettings: PaymentSettings = {
        defaultAmount: 250000,
        dueDate: 5,
        rwSettings: {
          activeRWs: [12],
          defaultRW: 12
        }
      }

      setStats(mockStats)
      setRecentPayments([])
      setUnpaidResidents([])
      setTotalIncome(0)
      setTotalProofs(0)
      setPaymentSettings(mockPaymentSettings)
    } finally {
      setLoading(false)
    }
  }

  const createSampleData = async () => {
    setCreatingSample(true)
    try {
      const response = await fetch('/api/periods/create-sample', {
        method: 'POST',
      })
      
      if (response.ok) {
        await fetchDashboardData()
        alert('Sample data berhasil dibuat!')
      } else {
        alert('Gagal membuat sample data')
      }
    } catch (error) {
      console.error('Error creating sample data:', error)
      alert('Gagal membuat sample data')
    } finally {
      setCreatingSample(false)
    }
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

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard IPL</h1>
          <p className="text-muted-foreground mt-1">
            Sistem Manajemen Pembayaran Iuran Pemeliharaan Lingkungan
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={fetchDashboardData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {process.env.NODE_ENV === 'development' && (
            <Button variant="outline" size="sm" onClick={createSampleData} disabled={creatingSample}>
              <Settings className="w-4 h-4 mr-2" />
              {creatingSample ? 'Membuat Data...' : 'Buat Sample Data'}
            </Button>
          )}
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Laporan
          </Button>
          <Link href="/payments">
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Tambah Pembayaran
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/residents">
          <Card className="card-hover cursor-pointer border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-300">Kelola Warga</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats?.totalResidents}</p>
                </div>
                <div className="p-3 rounded-full bg-blue-500/20">
                  <Users className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/payments">
          <Card className="card-hover cursor-pointer border-0 shadow-sm bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600 dark:text-green-300">Catat Pembayaran</p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">{stats?.totalPending}</p>
                </div>
                <div className="p-3 rounded-full bg-green-500/20">
                  <DollarSign className="h-6 w-6 text-green-600 dark:text-green-300" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card className="card-hover cursor-pointer border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600 dark:text-purple-300">Bukti Transfer</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{totalProofs}</p>
              </div>
              <div className="p-3 rounded-full bg-purple-500/20">
                <FileImage className="h-6 w-6 text-purple-600 dark:text-purple-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover cursor-pointer border-0 shadow-sm bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600 dark:text-orange-300">Pengingat</p>
                <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">{stats?.totalOverdue}</p>
              </div>
              <div className="p-3 rounded-full bg-orange-500/20">
                <MessageSquare className="h-6 w-6 text-orange-600 dark:text-orange-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="card-hover border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Warga</CardTitle>
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalResidents}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.totalPaid} sudah membayar
            </p>
          </CardContent>
        </Card>

        <Card className="card-hover border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pemasukan</CardTitle>
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalIncome)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.collectionRate}% tingkat pencapaian
            </p>
          </CardContent>
        </Card>

        <Card className="card-hover border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Menunggu Verifikasi</CardTitle>
            <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
              <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalPending}</div>
            <p className="text-xs text-muted-foreground">
              Perlu dicek bukti transfer
            </p>
          </CardContent>
        </Card>

        <Card className="card-hover border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Terlambat Bayar</CardTitle>
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalOverdue}</div>
            <p className="text-xs text-muted-foreground">
              Perlu dikirim pengingat
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Current Period Info */}
      <Card className="card-hover border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
              <Calendar className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            Periode Saat Ini
          </CardTitle>
          <CardDescription>
            Informasi periode pembayaran IPL yang sedang berlangsung
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Periode</p>
              <p className="text-lg font-semibold">{stats?.currentPeriod.name}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Iuran per Warga</p>
              <p className="text-lg font-semibold">
                {paymentSettings ? formatCurrency(paymentSettings.defaultAmount) : (stats ? formatCurrency(stats.currentPeriod.amount) : '-')}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Batas Pembayaran</p>
              <p className="text-lg font-semibold">{stats?.currentPeriod.dueDate}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Tingkat Pencapaian</p>
              <div className="space-y-3">
                <Progress value={stats?.collectionRate} className="w-full h-2" />
                <p className="text-sm font-medium">{stats?.collectionRate}%</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="recent" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="recent" className="text-sm">Pembayaran Terbaru</TabsTrigger>
          <TabsTrigger value="unpaid" className="text-sm">Belum Bayar</TabsTrigger>
          <TabsTrigger value="analytics" className="text-sm">Analitik</TabsTrigger>
        </TabsList>

        <TabsContent value="recent" className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                Pembayaran Terbaru
              </CardTitle>
              <CardDescription>
                Daftar pembayaran IPL yang tercatat dalam sistem
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-muted/50">
                      <TableHead className="font-medium">Nama Warga</TableHead>
                      <TableHead className="font-medium">Periode</TableHead>
                      <TableHead className="font-medium">Jumlah</TableHead>
                      <TableHead className="font-medium">Tanggal</TableHead>
                      <TableHead className="font-medium">Status</TableHead>
                      <TableHead className="font-medium">Bukti</TableHead>
                      <TableHead className="font-medium text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentPayments.map((payment) => (
                      <TableRow key={payment.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{payment.residentName}</TableCell>
                        <TableCell>{payment.period}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(payment.amount)}</TableCell>
                        <TableCell>{payment.paymentDate}</TableCell>
                        <TableCell>{getStatusBadge(payment.status)}</TableCell>
                        <TableCell>
                          {payment.hasProof ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800">
                              <ImageIcon className="w-3 h-3 mr-1" />
                              Ada
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Tidak ada</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Link href={`/payments`}>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <ImageIcon className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unpaid" className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                Warga Belum Bayar
              </CardTitle>
              <CardDescription>
                Daftar warga yang belum melakukan pembayaran IPL periode ini
              </CardDescription>
            </CardHeader>
            <CardContent>
              {unpaidResidents.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-muted/50">
                        <TableHead className="font-medium">Nama</TableHead>
                        <TableHead className="font-medium">Alamat</TableHead>
                        <TableHead className="font-medium">Telepon</TableHead>
                        <TableHead className="font-medium">Hari Terlambat</TableHead>
                        <TableHead className="font-medium text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unpaidResidents.map((resident) => (
                        <TableRow key={resident.id} className="hover:bg-muted/50">
                          <TableCell className="font-medium">{resident.name}</TableCell>
                          <TableCell>{resident.address}</TableCell>
                          <TableCell>{resident.phone}</TableCell>
                          <TableCell>
                            <Badge className="bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300">
                              {resident.daysOverdue} hari
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" className="h-8">
                                <MessageSquare className="w-4 h-4 mr-1" />
                                Kirim Pengingat
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    Semua warga telah melakukan pembayaran IPL periode ini!
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                Analitik Pembayaran
              </CardTitle>
              <CardDescription>
                Statistik dan tren pembayaran IPL
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <div className="mx-auto h-16 w-16 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center mb-4">
                  <TrendingUp className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="mt-4 text-lg font-medium text-muted-foreground">
                  Fitur analitik akan segera hadir
                </h3>
                <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                  Grafik dan laporan detail pembayaran sedang dalam pengembangan
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Tunggakan Statistics */}
      {overdueByRW.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Tunggakan per RW */}
          <Card className="card-hover border-0 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                Tunggakan per RW
              </CardTitle>
              <CardDescription>
                Statistik tunggakan pembayaran per RW
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {overdueByRW.map((rw) => (
                  <div key={rw.rw} className="flex items-center justify-between p-4 border rounded-lg bg-red-50/50 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                    <div>
                      <p className="font-medium">RW {rw.rw.toString().padStart(2, '0')}</p>
                      <p className="text-sm text-muted-foreground">
                        {rw.overdueResidents} dari {rw.totalResidents} warga
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-red-600 dark:text-red-400">{formatCurrency(rw.overdueAmount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {rw.totalResidents > 0 ? Math.round((rw.overdueResidents / rw.totalResidents) * 100) : 0}% tunggakan
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tunggakan per RT */}
          <Card className="card-hover border-0 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                  <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                Tunggakan per RT
              </CardTitle>
              <CardDescription>
                Statistik tunggakan pembayaran per RT
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                {overdueByRT.map((rt) => (
                  <div key={`${rt.rw}-${rt.rt}`} className="flex items-center justify-between p-3 border rounded-lg bg-orange-50/50 dark:bg-orange-950/20 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors">
                    <div>
                      <p className="text-sm font-medium">RW {rt.rw.toString().padStart(2, '0')} RT {rt.rt.toString().padStart(2, '0')}</p>
                      <p className="text-xs text-muted-foreground">
                        {rt.overdueResidents} dari {rt.totalResidents} warga
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">{formatCurrency(rt.overdueAmount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {rt.totalResidents > 0 ? Math.round((rt.overdueResidents / rt.totalResidents) * 100) : 0}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
