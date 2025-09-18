'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ErrorDisplay, LoadingError } from '@/components/ui/error-display'
import { LoadingCard, LoadingTable } from '@/components/ui/loading-states'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Users,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import { useZodFormValidation, createValidationSchemas } from '@/lib/form-validation'
import { fetchWithHandling, postWithHandling, putWithHandling, deleteWithHandling } from '@/lib/api-utils'

interface Resident {
  id: string
  name: string
  address: string
  phone: string
  email?: string
  rt: number
  rw: number
  blok?: string
  house_number?: string
  payment_index?: number
  ownership?: 'MILIK' | 'SEWA' | null
  is_active: boolean
  created_at: string
  createdBy: {
    id: string
    name?: string
    email: string
  }
  rtRelation?: {
    id: string
    chairman?: string
  }
  _count: {
    payments: number
  }
}

interface ResidentsResponse {
  residents: Resident[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

interface FormData {
  name: string
  address: string
  phone: string
  email?: string
  rt: number
  rw: number
  blok?: string
  house_number?: string
  payment_index?: number
  ownership?: 'MILIK' | 'SEWA' | null
  rt_id?: string
}

export default function ResidentsPage() {
  const [residents, setResidents] = useState<Resident[]>([])
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRt, setFilterRt] = useState('all')
  const [filterRw, setFilterRw] = useState('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingResident, setEditingResident] = useState<Resident | null>(null)
  const [rts, setRTs] = useState<any[]>([])
  const [submitting, setSubmitting] = useState(false)
  
  // Use form validation hook
  const {
    values: formData,
    errors: formErrors,
    handleChange,
    handleSubmit,
    getFieldError,
    hasFieldError,
    reset: resetForm,
    setValues: setFormDataValues
  } = useZodFormValidation(
    createValidationSchemas.resident,
    {
      name: '',
      address: '',
      phone: '',
      email: '',
      rt: 1,
      rw: 1,
      blok: '',
      house_number: '',
      payment_index: undefined,
      ownership: null,
      rt_id: undefined
    }
  )

  useEffect(() => {
    fetchResidents()
    fetchRTs()
  }, [pagination.page, pagination.limit, searchTerm, filterRt, filterRw])

  const fetchResidents = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      })

      if (searchTerm) params.append('search', searchTerm)
      if (filterRt) params.append('rt', filterRt)
      if (filterRw) params.append('rw', filterRw)

      const data = await fetchWithHandling<ResidentsResponse>(`/api/residents?${params}`)
      setResidents(data.residents)
      setPagination(data.pagination)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Gagal mengambil data warga')
    } finally {
      setLoading(false)
    }
  }

  const fetchRTs = async () => {
    try {
      const response = await fetch('/api/rts')
      if (!response.ok) throw new Error('Gagal mengambil data RT')
      const data = await response.json()
      setRTs(data.rts || [])
    } catch (error) {
      console.error('Error fetching RTs:', error)
    }
  }

  const handleFormSubmitLogic = async (data: any) => {
    try {
      const url = editingResident ? `/api/residents/${editingResident.id}` : '/api/residents'
      const method = editingResident ? 'PUT' : 'POST'

      if (editingResident) {
        await putWithHandling(url, data)
      } else {
        await postWithHandling(url, data)
      }

      await fetchResidents()
      setIsDialogOpen(false)
      resetForm()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Gagal menyimpan data warga')
    } finally {
      setSubmitting(false)
    }
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const url = editingResident ? `/api/residents/${editingResident.id}` : '/api/residents'
      const method = editingResident ? 'PUT' : 'POST'

      if (editingResident) {
        await putWithHandling(url, formData)
      } else {
        await postWithHandling(url, formData)
      }

      await fetchResidents()
      setIsDialogOpen(false)
      resetForm()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Gagal menyimpan data warga')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (resident: Resident) => {
    setEditingResident(resident)
    setFormDataValues({
      name: resident.name,
      address: resident.address,
      phone: resident.phone,
      email: resident.email || '',
      rt: resident.rt,
      rw: resident.rw,
      blok: resident.blok || '',
      house_number: resident.house_number || '',
      payment_index: resident.payment_index,
      ownership: resident.ownership || null,
      rt_id: resident.rtRelation?.id
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus warga ini?')) return

    try {
      const response = await fetch(`/api/residents/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Gagal menghapus warga')

      await fetchResidents()
    } catch (error) {
      console.error('Error deleting resident:', error)
      setError('Gagal menghapus warga')
    }
  }

  const resetLocalForm = () => {
    setFormDataValues({
      name: '',
      address: '',
      phone: '',
      email: '',
      rt: 1,
      rw: 1,
      blok: '',
      house_number: '',
      payment_index: undefined,
      ownership: null,
      rt_id: undefined
    })
    setEditingResident(null)
    setError('')
  }

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }))
  }

  const formatPhoneNumber = (phone: string) => {
    return phone.replace(/(\d{4})(\d{4})(\d{4})/, '$1-$2-$3')
  }

  if (loading && residents.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Manajemen Warga</h1>
            <p className="text-muted-foreground">Kelola data warga RW</p>
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
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manajemen Warga</h1>
          <p className="text-muted-foreground">Kelola data warga RW</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Tambah Warga
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>
                {editingResident ? 'Edit Data Warga' : 'Tambah Warga Baru'}
              </DialogTitle>
              <DialogDescription>
                {editingResident
                  ? 'Edit informasi data warga yang sudah terdaftar.'
                  : 'Tambahkan warga baru ke dalam sistem.'
                }
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              setSubmitting(true);
              setError('');
              
              const result = handleSubmit((data) => {
                handleFormSubmitLogic(data);
              });
              
              // If validation fails, make sure to reset submitting state
              if (!result.isValid) {
                setSubmitting(false);
              }
            }}>
              <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-4 items-start gap-2">
                  <Label htmlFor="name" className="text-right pt-2">
                    Nama
                  </Label>
                  <div className="col-span-3 space-y-1">
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      required
                    />
                    {hasFieldError('name') && getFieldError('name') && (
                      <p className="text-xs text-red-500">{getFieldError('name')}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 items-start gap-2">
                  <Label htmlFor="address" className="text-right pt-2">
                    Alamat
                  </Label>
                  <div className="col-span-3 space-y-1">
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormDataValues(prev => ({ ...prev, address: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-4 items-start gap-2">
                  <Label htmlFor="phone" className="text-right pt-2">
                    Telepon
                  </Label>
                  <div className="col-span-3 space-y-1">
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      required
                    />
                    {hasFieldError('phone') && getFieldError('phone') && (
                      <p className="text-xs text-red-500">{getFieldError('phone')}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 items-start gap-2">
                  <Label htmlFor="email" className="text-right pt-2">
                    Email
                  </Label>
                  <div className="col-span-3 space-y-1">
                    <Input
                      id="email"
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => handleChange('email', e.target.value)}
                    />
                    {hasFieldError('email') && getFieldError('email') && (
                      <p className="text-xs text-red-500">{getFieldError('email')}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 items-start gap-2">
                  <Label htmlFor="rt" className="text-right pt-2">
                    RT
                  </Label>
                  <div className="col-span-3 space-y-1">
                    <Select
                      value={formData.rt_id || ''}
                      onValueChange={(value) => {
                        const selected = rts.find((r) => r.id === value)
                        setFormDataValues(prev => ({
                          ...prev,
                          rt_id: value,
                          rt: selected ? selected.number : prev.rt,
                          rw: selected ? selected.rw : prev.rw,
                        }))
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih RT" />
                      </SelectTrigger>
                      <SelectContent>
                        {rts.map((rt: any) => (
                          <SelectItem key={rt.id} value={rt.id}>
                            RT {rt.number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-start gap-2">
                  <Label htmlFor="rw" className="text-right pt-2">
                    RW
                  </Label>
                  <div className="col-span-3 space-y-1">
                    <Select
                      value={formData.rw.toString()}
                      onValueChange={(value) => {
                        setFormDataValues(prev => ({
                          ...prev,
                          rw: parseInt(value),
                          rt: 1, // Reset RT when RW changes
                          rt_id: undefined
                        }))
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 20 }, (_, i) => i + 1).map((rw) => (
                          <SelectItem key={rw} value={rw.toString()}>
                            {rw}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-start gap-2">
                  <Label htmlFor="blok" className="text-right pt-2">
                    BLOK
                  </Label>
                  <div className="col-span-3 space-y-1">
                    <Input
                      id="blok"
                      value={formData.blok || ''}
                      onChange={(e) => handleChange('blok', e.target.value)}
                      placeholder="e.g., C11"
                    />
                    {hasFieldError('blok') && getFieldError('blok') && (
                      <p className="text-xs text-red-500">{getFieldError('blok')}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 items-start gap-2">
                  <Label htmlFor="house_number" className="text-right pt-2">
                    No. Rumah
                  </Label>
                  <div className="col-span-3 space-y-1">
                    <Input
                      id="house_number"
                      value={formData.house_number || ''}
                      onChange={(e) => handleChange('house_number', e.target.value)}
                      placeholder="e.g., 9"
                    />
                    {hasFieldError('house_number') && getFieldError('house_number') && (
                      <p className="text-xs text-red-500">{getFieldError('house_number')}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 items-start gap-2">
                  <Label htmlFor="payment_index" className="text-right pt-2">
                    Index Bayar
                  </Label>
                  <div className="col-span-3 space-y-1">
                    <Input
                      id="payment_index"
                      type="number"
                      value={formData.payment_index || ''}
                      onChange={(e) => handleChange('payment_index', e.target.value ? parseInt(e.target.value) : undefined)}
                      placeholder="e.g., 1109"
                    />
                    {hasFieldError('payment_index') && getFieldError('payment_index') && (
                      <p className="text-xs text-red-500">{getFieldError('payment_index')}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 items-start gap-2">
                  <Label htmlFor="ownership" className="text-right pt-2">
                    Kepemilikan Rumah
                  </Label>
                  <div className="col-span-3 space-y-1">
                    <Select
                      value={formData.ownership || ''}
                      onValueChange={(value) => handleChange('ownership', value === '' ? null : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih kepemilikan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="empty">-</SelectItem>
                        <SelectItem value="MILIK">Milik</SelectItem>
                        <SelectItem value="SEWA">Sewa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              {error && <ErrorDisplay message={error} />}
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Menyimpan...' : (editingResident ? 'Update' : 'Simpan')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Pencarian & Filter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Cari nama, alamat, atau telepon..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterRt} onValueChange={setFilterRt}>
              <SelectTrigger>
                <SelectValue placeholder="Filter RT" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua RT</SelectItem>
                {Array.from(new Map(rts.map((rt: any) => [rt.number, rt])).values())
                  .sort((a: any, b: any) => a.number - b.number)
                  .map((rt: any) => (
                    <SelectItem key={rt.number} value={rt.number.toString()}>
                      RT {rt.number}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Select value={filterRw} onValueChange={setFilterRw}>
              <SelectTrigger>
                <SelectValue placeholder="Filter RW" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua RW</SelectItem>
                {Array.from(new Set(rts.map(rt => rt.rw))).sort().map((rw) => (
                  <SelectItem key={rw} value={rw.toString()}>
                    RW {rw}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => {
              setSearchTerm('')
              setFilterRt('all')
              setFilterRw('all')
            }}>
              Reset Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Residents Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Daftar Warga
          </CardTitle>
          <CardDescription>
            Total {pagination.total} warga terdaftar
          </CardDescription>
        </CardHeader>
        <CardContent>
          {residents.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium text-muted-foreground">
                Belum ada data warga
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Mulai tambahkan warga baru ke dalam sistem
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Alamat</TableHead>
                    <TableHead>Kontak</TableHead>
                    <TableHead>RT/RW</TableHead>
                    <TableHead>BLOK/No. Rumah</TableHead>
                    <TableHead>Index Bayar</TableHead>
                    <TableHead>Kepemilikan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pembayaran</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {residents.map((resident) => (
                    <TableRow key={resident.id}>
                      <TableCell className="font-medium">{resident.name}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-gray-400" />
                          <span className="text-sm">{resident.address}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-gray-400" />
                            <span className="text-sm">{formatPhoneNumber(resident.phone)}</span>
                          </div>
                          {resident.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3 text-gray-400" />
                              <span className="text-sm text-muted-foreground">{resident.email}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">RT {resident.rt}/RW {resident.rw}</Badge>
                      </TableCell>
                      <TableCell>
                        {resident.blok && resident.house_number ? (
                          <Badge variant="outline">{resident.blok}/{resident.house_number}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {resident.payment_index ? (
                          <Badge variant="default" className="bg-blue-100 text-blue-800">
                            {resident.payment_index}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {resident.ownership ? (
                          <Badge variant={resident.ownership === 'MILIK' ? 'default' : 'secondary'}>
                            {resident.ownership === 'MILIK' ? 'Milik' : 'Sewa'}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {resident.is_active ? (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Aktif
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Tidak Aktif</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{resident._count.payments} pembayaran</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(resident)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(resident.id)}
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
                            is_active={pagination.page === page}
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