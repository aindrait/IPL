'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { format } from 'date-fns'
import { Trash2, SkipForward, CheckCircle, Search, Filter, X, Edit, DollarSign } from 'lucide-react'

type Item = {
  id: string
  type: 'MONTHLY' | 'SPECIAL' | 'DONATION'
  label: string | null
  amount: number
  status: 'PLANNED' | 'PAID' | 'SKIPPED' | 'CARRIED_OVER' | 'OPTIONAL'
  dueDate: string
  paidDate: string | null
  resident: { id: string; name: string | null; blok: string | null; houseNumber: string | null; rt: number | null; rw: number | null }
  period: { id: string; name: string; month: number; year: number; amount: number; dueDate: string }
  schedule: { id: string; name: string }
}

export default function SchedulesPage() {
  const [items, setItems] = useState<Item[]>([])
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [openGen, setOpenGen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
  const [skipLoading, setSkipLoading] = useState(false)
  const [skipReason, setSkipReason] = useState('')
  const [skipDialogOpen, setSkipDialogOpen] = useState(false)
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [rtFilter, setRtFilter] = useState<string>('all')
  const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear())
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [periodFilter, setPeriodFilter] = useState<string>('all') // New: month filter
  const [showFilters, setShowFilters] = useState(false)
  const [availableRTs, setAvailableRTs] = useState<number[]>([])
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  
  // Edit amount states
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editMode, setEditMode] = useState<'single' | 'multi'>('single')
  const [editItemId, setEditItemId] = useState<string>('')
  const [newAmount, setNewAmount] = useState<string>('')
  const [editReason, setEditReason] = useState('')
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })
  
  // Totals state (excluding SKIPPED items)
  const [totals, setTotals] = useState({
    totalAmount: 0,
    totalItems: 0,
    totalPaidAmount: 0,
    totalPaidItems: 0
  })

  // Generation form state
  const [genName, setGenName] = useState('Jadwal IPL')
  const [genDesc, setGenDesc] = useState('')
  const [startMonth, setStartMonth] = useState<number>(new Date().getMonth() + 1)
  const [startYear, setStartYear] = useState<number>(new Date().getFullYear())
  const [months, setMonths] = useState<number>(12)
  const [amount, setAmount] = useState<number>(parseInt((process.env.NEXT_PUBLIC_IPL_BASE_AMOUNT || "200000").split(',')[0], 10) || 200000)
  const [defaultSettings, setDefaultSettings] = useState<any>(null)
  const [scheduleType, setScheduleType] = useState<'IPL' | 'THR' | 'Sumbangan'>('IPL')
  const [isMandatory, setIsMandatory] = useState<boolean>(true)
  const [customDueDate, setCustomDueDate] = useState<string>('')
  const [autoSkipLoading, setAutoSkipLoading] = useState(false)

  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected])

  const fetchItems = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        includePaid: 'true'
      })
      
      // Add search and filter parameters
      if (debouncedSearchTerm) {
        params.append('search', debouncedSearchTerm)
      }
      if (rtFilter !== 'all') {
        params.append('rt', rtFilter)
      }
      if (yearFilter) {
        params.append('year', yearFilter.toString())
      }
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }
      if (typeFilter !== 'all') {
        params.append('type', typeFilter)
      }
      if (periodFilter !== 'all') {
        params.append('month', periodFilter)
      }
      
      const res = await fetch(`/api/schedules/items?${params}`)
      const data = await res.json()
      setItems(data.items || [])
      
      // Safe pagination handling
      if (data.pagination) {
        setPagination({
          page: data.pagination.page || 1,
          limit: data.pagination.limit || 20,
          total: data.pagination.total || 0,
          totalPages: data.pagination.totalPages || 0
        })
      } else {
        // Fallback pagination
        setPagination({
          page: 1,
          limit: 20,
          total: data.items?.length || 0,
          totalPages: Math.ceil((data.items?.length || 0) / 20)
        })
      }
      
      // Update totals (excluding SKIPPED items)
      if (data.totals) {
        setTotals(data.totals)
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchFilterOptions = async () => {
    try {
      // Fetch available RTs
      const rtsResponse = await fetch('/api/rts')
      const rtsData = await rtsResponse.json()
      setAvailableRTs(rtsData.rts?.map((rt: any) => rt.number) || [])

      // Fetch available years from periods
      const periodsResponse = await fetch('/api/periods')
      const periodsData = await periodsResponse.json()
      const years = [...new Set(periodsData.periods?.map((p: any) => p.year) || [])].filter((year): year is number => typeof year === 'number')
      
      // Ensure current year is always available
      const currentYear = new Date().getFullYear()
      const uniqueYears = [...new Set([currentYear, ...years])]
      setAvailableYears(uniqueYears.sort((a, b) => b - a))
    } catch (error) {
      console.error('Error fetching filter options:', error)
      // Fallback: at least show current year
      const currentYear = new Date().getFullYear()
      setAvailableYears([currentYear])
    }
  }

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)
    
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch data when filters change (with automatic page reset)
  useEffect(() => {
    // Reset to page 1 when filters change (but not when only pagination changes)
    const isFilterChange = debouncedSearchTerm || rtFilter !== 'all' || statusFilter !== 'all' || typeFilter !== 'all' || periodFilter !== 'all'
    if (isFilterChange && pagination.page !== 1) {
      setPagination(prev => ({ ...prev, page: 1 }))
      return // Let the next useEffect call fetchItems with page 1
    }
    
    fetchItems()
    fetchDefaultSettings()
  }, [pagination.page, pagination.limit, debouncedSearchTerm, rtFilter, yearFilter, statusFilter, typeFilter, periodFilter])

  // Fetch available filter options
  useEffect(() => {
    fetchFilterOptions()
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + K to focus search
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault()
        const searchInput = document.querySelector('input[placeholder*="Cari"]') as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
        }
      }
      
      // Escape to clear search when search input is focused
      if (event.key === 'Escape') {
        const activeElement = document.activeElement as HTMLInputElement
        if (activeElement && activeElement.placeholder?.includes('Cari')) {
          setSearchTerm('')
          activeElement.blur()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const fetchDefaultSettings = async () => {
    try {
      const response = await fetch('/api/settings')
      const data = await response.json()
      setDefaultSettings(data.paymentSettings)
      setAmount(data.paymentSettings.defaultAmount)
    } catch (error) {
      console.error('Error fetching default settings:', error)
    }
  }

  const toggle = (id: string) => setSelected((prev) => ({ ...prev, [id]: !prev[id] }))
  const toggleAll = (checked: boolean) => {
    const next: Record<string, boolean> = {}
    for (const it of items) next[it.id] = checked
    setSelected(next)
  }

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }))
  }
  const handlePageSizeChange = (limit: number) => {
    setPagination(prev => ({ ...prev, page: 1, limit }))
  }

  // Derived display range for UX (e.g., Showing 1–20 of 240)
  const startIndex = useMemo(() => (pagination.page - 1) * pagination.limit + (items.length > 0 ? 1 : 0), [pagination.page, pagination.limit, items.length])
  const endIndex = useMemo(() => (pagination.page - 1) * pagination.limit + items.length, [pagination.page, pagination.limit, items.length])

  const markPaid = async () => {
    if (selectedIds.length === 0) return
    const paymentDate = prompt('Tanggal pembayaran (YYYY-MM-DD):')
    if (!paymentDate) return
    const paymentMethod = prompt('Metode pembayaran (opsional):') || undefined
    const notes = prompt('Catatan (opsional):') || undefined
    
    try {
      const res = await fetch('/api/schedules/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: selectedIds, paymentDate, paymentMethod, notes }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Gagal menandai sebagai dibayar')
      } else {
        await fetchItems()
        setSelected({})
      }
    } catch (error) {
      alert('Error: ' + error)
    }
  }

  const openEditDialog = (mode: 'single' | 'multi', itemId?: string) => {
    setEditMode(mode)
    setEditItemId(itemId || '')
    setNewAmount('')
    setEditReason('')
    setEditDialogOpen(true)
    
    // Pre-fill amount for single edit
    if (mode === 'single' && itemId) {
      const item = items.find(i => i.id === itemId)
      if (item) {
        setNewAmount(item.amount.toString())
      }
    }
  }

  const editAmount = async () => {
    if (editLoading) return
    
    const itemsToEdit = editMode === 'single' 
      ? [editItemId].filter(Boolean)
      : selectedIds
    
    if (itemsToEdit.length === 0) {
      alert('Pilih item untuk diedit')
      return
    }
    
    const amount = parseFloat(newAmount)
    if (isNaN(amount) || amount < 0) {
      alert('Nominal harus berupa angka positif')
      return
    }

    setEditLoading(true)
    try {
      const response = await fetch('/api/schedules/edit-amount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemIds: itemsToEdit,
          newAmount: amount,
          reason: editReason || 'Edit nominal schedule'
        })
      })

      const result = await response.json()
      if (response.ok) {
        alert(`Berhasil mengubah nominal ${itemsToEdit.length} item`)
        setEditDialogOpen(false)
        setSelected({})
        fetchItems()
      } else {
        alert(result.error || 'Gagal mengubah nominal')
      }
    } catch (error) {
      console.error('Error editing amount:', error)
      alert('Terjadi kesalahan saat mengubah nominal')
    } finally {
      setEditLoading(false)
    }
  }

  const skipItems = async () => {
    if (selectedIds.length === 0) return
    setSkipLoading(true)
    
    try {
      const res = await fetch('/api/schedules/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: selectedIds, reason: skipReason }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Gagal melewati item')
      } else {
        await fetchItems()
        setSelected({})
        setSkipReason('')
        setSkipDialogOpen(false) // Close dialog after success
      }
    } finally {
      setSkipLoading(false)
    }
  }

  const deleteScheduleItem = async (itemId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus item jadwal ini?')) {
      return
    }
    
    setDeleteLoading(itemId)
    try {
      await fetch(`/api/schedules/items?id=${itemId}`, {
        method: 'DELETE',
      })
      await fetchItems()
      setSelected({})
    } catch (error) {
      console.error('Error deleting schedule item:', error)
      alert('Gagal menghapus item jadwal')
    } finally {
      setDeleteLoading(null)
    }
  }

  const deleteSchedule = async (scheduleId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus jadwal ini? Semua item terkait juga akan dihapus.')) {
      return
    }
    
    setDeleteLoading(scheduleId)
    try {
      await fetch(`/api/schedules?id=${scheduleId}`, {
        method: 'DELETE',
      })
      await fetchItems()
      setSelected({})
    } catch (error) {
      console.error('Error deleting schedule:', error)
      alert('Gagal menghapus jadwal')
    } finally {
      setDeleteLoading(null)
    }
  }

  const deleteSelectedSchedules = async () => {
    if (selectedIds.length === 0) return
    
    if (!confirm(`Apakah Anda yakin ingin menghapus ${selectedIds.length} item jadwal?`)) {
      return
    }
    
    setDeleteLoading('multiple')
    try {
      // Delete individual items instead of entire schedules
      await Promise.all(selectedIds.map(itemId =>
        fetch(`/api/schedules/items?id=${itemId}`, {
          method: 'DELETE',
        })
      ))
      
      await fetchItems()
      setSelected({})
    } catch (error) {
      console.error('Error deleting selected schedule items:', error)
      alert('Gagal menghapus item jadwal yang dipilih')
    } finally {
      setDeleteLoading(null)
    }
  }

  const clearFilters = () => {
    setSearchTerm('')
    setRtFilter('all')
    // Don't reset year filter - keep it as current year
    setStatusFilter('all')
    setTypeFilter('all')
    setPeriodFilter('all')
    setShowFilters(false)
  }

  const hasActiveFilters = () => {
    return searchTerm !== '' || 
           rtFilter !== 'all' || 
           yearFilter !== new Date().getFullYear() || 
           statusFilter !== 'all' || 
           typeFilter !== 'all' ||
           periodFilter !== 'all'
  }

  const generate = async () => {
    if (generating) return
    setGenerating(true)
    const payload: any = {
      name: genName,
      description: genDesc,
      startMonth,
      startYear,
      months,
      amount: scheduleType === 'Sumbangan' && !isMandatory ? 0 : amount, // Force 0 for voluntary donations
      scheduleType,
      isMandatory,
    }
    
    // Add custom due date for THR and Sumbangan
    if ((scheduleType === 'THR' || scheduleType === 'Sumbangan') && customDueDate) {
      payload.customDueDate = customDueDate
    }
    
    // Validation for THR and Sumbangan requiring custom due date
    if ((scheduleType === 'THR' || scheduleType === 'Sumbangan') && !customDueDate) {
      alert('Tanggal jatuh tempo harus diisi untuk ' + scheduleType)
      setGenerating(false)
      return
    }
    
    try {
      const res = await fetch('/api/schedules/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Gagal generate jadwal')
      } else {
        setOpenGen(false)
        await fetchItems()
      }
    } finally {
      setGenerating(false)
    }
  }

  const autoSkipExpired = async () => {
    if (autoSkipLoading) return
    
    setAutoSkipLoading(true)
    try {
      const response = await fetch('/api/schedules/auto-skip-expired', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      const result = await response.json()
      if (response.ok) {
        alert(result.message)
        if (result.skippedCount > 0) {
          fetchItems() // Refresh data
        }
      } else {
        alert(result.error || 'Gagal melakukan auto-skip')
      }
    } catch (error) {
      console.error('Error auto-skipping expired donations:', error)
      alert('Terjadi error saat auto-skip')
    } finally {
      setAutoSkipLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Payment Schedules</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Total: {pagination.total} items • Target: {totals.totalItems} items (Rp {totals.totalAmount.toLocaleString('id-ID')}) • Tahun {yearFilter}
            </p>
            <p className="text-xs text-muted-foreground">
              Terbayar: {totals.totalPaidItems} items (Rp {totals.totalPaidAmount.toLocaleString('id-ID')}) • 
              Rate: {totals.totalItems > 0 ? Math.round((totals.totalPaidItems / totals.totalItems) * 100) : 0}%
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Year Selector */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Tahun:</span>
              <select
                value={yearFilter.toString()}
                onChange={(e) => setYearFilter(parseInt(e.target.value))}
                className="h-8 px-2 border border-input bg-background rounded-md font-medium"
              >
                {availableYears.length > 0 ? (
                  availableYears.map((year) => (
                    <option key={year} value={year.toString()}>
                      {year}
                    </option>
                  ))
                ) : (
                  <option value={new Date().getFullYear().toString()}>
                    {new Date().getFullYear()}
                  </option>
                )}
              </select>
            </div>
            
            {/* Action Buttons */}
            <div className="space-x-2">
            <Button 
              variant="outline" 
              onClick={autoSkipExpired}
              disabled={autoSkipLoading}
              className="text-orange-600 border-orange-300 hover:bg-orange-50"
            >
              {autoSkipLoading ? 'Processing...' : 'Auto-Skip Expired'}
            </Button>
            <Dialog open={openGen} onOpenChange={setOpenGen}>
              <DialogTrigger asChild>
                <Button variant="secondary">Generate</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Generate Schedules</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Nama</Label>
                    <Input value={genName} onChange={(e) => setGenName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Deskripsi</Label>
                    <Input value={genDesc} onChange={(e) => setGenDesc(e.target.value)} />
                  </div>
                  <div>
                    <Label>Mulai Bulan</Label>
                    <Input type="number" value={startMonth} onChange={(e) => setStartMonth(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Mulai Tahun</Label>
                    <Input type="number" value={startYear} onChange={(e) => setStartYear(Number(e.target.value))} />
                  </div>
                  {scheduleType === 'IPL' && (
                    <div>
                      <Label>Jumlah Bulan</Label>
                      <Input type="number" value={months} onChange={(e) => setMonths(Number(e.target.value))} />
                    </div>
                  )}
                  <div>
                    <Label>
                      {scheduleType === 'IPL' ? 'Nominal / Bulan' : 'Nominal'}
                      {scheduleType === 'Sumbangan' && !isMandatory && ' (Opsional)'}
                    </Label>
                    <Input 
                      type="number" 
                      value={scheduleType === 'Sumbangan' && !isMandatory ? 0 : amount} 
                      onChange={(e) => setAmount(Number(e.target.value))} 
                      disabled={scheduleType === 'Sumbangan' && !isMandatory}
                      placeholder={scheduleType === 'Sumbangan' && !isMandatory ? 'Nominal sukarela (bebas)' : ''}
                    />
                    {scheduleType === 'Sumbangan' && !isMandatory && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Sumbangan sukarela tidak memiliki nominal tetap. Warga bisa membayar sesuai kemampuan.
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Tipe Jadwal</Label>
                    <select
                      value={scheduleType}
                      onChange={(e) => {
                        const newType = e.target.value as 'IPL' | 'THR' | 'Sumbangan'
                        setScheduleType(newType)
                        // Auto-set mandatory status based on type
                        if (newType === 'IPL' || newType === 'THR') {
                          setIsMandatory(true)
                        }
                        // Reset custom due date when changing type
                        setCustomDueDate('')
                      }}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="IPL">IPL</option>
                      <option value="THR">THR</option>
                      <option value="Sumbangan">Sumbangan</option>
                    </select>
                  </div>
                  
                  {/* Custom Due Date for THR and Sumbangan */}
                  {(scheduleType === 'THR' || scheduleType === 'Sumbangan') && (
                    <div>
                      <Label>Tanggal Jatuh Tempo</Label>
                      <Input 
                        type="date" 
                        value={customDueDate} 
                        onChange={(e) => setCustomDueDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {scheduleType === 'THR' ? 'Tanggal jatuh tempo THR' : 'Tanggal batas waktu sumbangan'}
                      </p>
                    </div>
                  )}
                  
                  <div>
                    <Label>Status Pembayaran</Label>
                    <select
                      value={isMandatory ? 'wajib' : 'sukarela'}
                      onChange={(e) => setIsMandatory(e.target.value === 'wajib')}
                      disabled={scheduleType === 'IPL' || scheduleType === 'THR'} // IPL and THR are always mandatory
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="wajib">Wajib</option>
                      {scheduleType === 'Sumbangan' && <option value="sukarela">Sukarela</option>}
                    </select>
                    {(scheduleType === 'IPL' || scheduleType === 'THR') && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {scheduleType} selalu berstatus wajib
                      </p>
                    )}
                  </div>
                </div>
                {/* Special inputs removed; choose THR via Tipe Jadwal */}
                <div className="mt-4 flex justify-end">
                  <Button onClick={generate} disabled={generating}>
                    {generating ? 'Generating…' : 'Generate'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Button
              onClick={markPaid}
              disabled={selectedIds.length === 0}
              variant="default"
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Manual Paid ({selectedIds.length})
            </Button>

            <Button
              disabled={selectedIds.length === 0}
              variant="outline"
              onClick={() => openEditDialog('multi')}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Amount ({selectedIds.length})
            </Button>

            <Dialog open={skipDialogOpen} onOpenChange={setSkipDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  disabled={selectedIds.length === 0}
                  variant="outline"
                >
                  <SkipForward className="h-4 w-4 mr-2" />
                  Skip ({selectedIds.length})
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Skip Items</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Alasan (Opsional)</Label>
                    <Input 
                      value={skipReason} 
                      onChange={(e) => setSkipReason(e.target.value)}
                      placeholder="Contoh: Warga pindah, tidak berlaku, dll"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      onClick={skipItems}
                      disabled={skipLoading}
                      variant="outline"
                    >
                      {skipLoading ? 'Processing...' : 'Skip Items'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Edit Amount Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    {editMode === 'single' ? 'Edit Nominal Item' : `Edit Nominal ${selectedIds.length} Items`}
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                  {/* Preview Items */}
                  {editMode === 'multi' && selectedIds.length > 0 && (
                    <div className="max-h-32 overflow-y-auto border rounded-md p-3 bg-gray-50">
                      <p className="text-sm font-medium mb-2">Items yang akan diubah:</p>
                      {selectedIds.slice(0, 5).map(id => {
                        const item = items.find(i => i.id === id)
                        return item ? (
                          <div key={id} className="text-xs text-gray-600 flex justify-between">
                            <span>{item.resident?.name} - {item.label}</span>
                            <span>Rp {item.amount.toLocaleString('id-ID')}</span>
                          </div>
                        ) : null
                      })}
                      {selectedIds.length > 5 && (
                        <p className="text-xs text-gray-500 mt-1">
                          +{selectedIds.length - 5} item lainnya...
                        </p>
                      )}
                    </div>
                  )}

                  {/* Amount Input */}
                  <div className="space-y-2">
                    <Label htmlFor="newAmount">Nominal Baru</Label>
                    <Input
                      id="newAmount"
                      type="number"
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      placeholder="Masukkan nominal baru"
                      min="0"
                      step="1000"
                    />
                    <p className="text-xs text-gray-500">
                      {newAmount && !isNaN(parseFloat(newAmount)) && 
                        `Rp ${parseFloat(newAmount).toLocaleString('id-ID')}`}
                    </p>
                  </div>

                  {/* Reason Input */}
                  <div className="space-y-2">
                    <Label htmlFor="editReason">Alasan Perubahan</Label>
                    <Input
                      id="editReason"
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      placeholder="Contoh: Dispensasi khusus, keringanan, dll"
                    />
                  </div>

                  {/* Confirmation */}
                  {editMode === 'multi' && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-sm text-yellow-800">
                        ⚠️ Anda akan mengubah nominal dari <strong>{selectedIds.length} item</strong> sekaligus. 
                        Pastikan nominal sudah benar sebelum melanjutkan.
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setEditDialogOpen(false)}
                      disabled={editLoading}
                    >
                      Batal
                    </Button>
                    <Button
                      onClick={editAmount}
                      disabled={editLoading || !newAmount || isNaN(parseFloat(newAmount))}
                    >
                      {editLoading ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button
              onClick={deleteSelectedSchedules}
              disabled={selectedIds.length === 0}
              variant="destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete ({selectedIds.length})
            </Button>
            </div>
          </div>
        </CardHeader>
        
        {/* Search and Filter Section */}
        <div className="px-6 pb-4 border-b">
          {/* Search Bar */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Cari nama, RT, RW, blok, label, periode... (Ctrl+K)"
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

          {/* Search Tips */}
          {searchTerm && (
            <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-4">
              <span>💡 Tips:</span>
              <span>"RT1" atau "RT01" untuk RT tertentu</span>
              <span>"RW2" untuk RW tertentu</span>
              <span>"Blok A" untuk blok tertentu</span>
            </div>
          )}

          {/* Advanced Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
              {/* RT Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">RT</Label>
                <select
                  value={rtFilter}
                  onChange={(e) => setRtFilter(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="all">Semua RT</option>
                  {availableRTs.map((rt) => (
                    <option key={rt} value={rt.toString()}>
                      RT {rt.toString().padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Period Filter (Month) */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Bulan</Label>
                <select
                  value={periodFilter}
                  onChange={(e) => setPeriodFilter(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="all">Semua Bulan</option>
                  <option value="1">Januari</option>
                  <option value="2">Februari</option>
                  <option value="3">Maret</option>
                  <option value="4">April</option>
                  <option value="5">Mei</option>
                  <option value="6">Juni</option>
                  <option value="7">Juli</option>
                  <option value="8">Agustus</option>
                  <option value="9">September</option>
                  <option value="10">Oktober</option>
                  <option value="11">November</option>
                  <option value="12">Desember</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Status</Label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="all">Semua Status</option>
                  <option value="PLANNED">Terjadwal</option>
                  <option value="PAID">Dibayar</option>
                  <option value="SKIPPED">Dilewati</option>
                  <option value="OPTIONAL">Opsional</option>
                </select>
              </div>

              {/* Type Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tipe</Label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="all">Semua Tipe</option>
                  <option value="MONTHLY">IPL Bulanan</option>
                  <option value="SPECIAL">THR</option>
                  <option value="DONATION">Sumbangan</option>
                </select>
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
                  RT {rtFilter.padStart(2, '0')}
                  <button onClick={() => setRtFilter('all')} className="hover:text-green-600">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              
              {periodFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                  {new Date(0, parseInt(periodFilter) - 1).toLocaleDateString('id-ID', { month: 'long' })}
                  <button onClick={() => setPeriodFilter('all')} className="hover:text-purple-600">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              
              {statusFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                  {statusFilter === 'PLANNED' ? 'Terjadwal' : 
                   statusFilter === 'PAID' ? 'Dibayar' :
                   statusFilter === 'SKIPPED' ? 'Dilewati' : 
                   statusFilter === 'OPTIONAL' ? 'Opsional' : statusFilter}
                  <button onClick={() => setStatusFilter('all')} className="hover:text-orange-600">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              
              {typeFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-pink-100 text-pink-800 text-xs rounded-full">
                  {typeFilter === 'MONTHLY' ? 'IPL Bulanan' : 
                   typeFilter === 'SPECIAL' ? 'THR' : 
                   typeFilter === 'DONATION' ? 'Sumbangan' : typeFilter}
                  <button onClick={() => setTypeFilter('all')} className="hover:text-pink-600">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox onCheckedChange={(c) => toggleAll(Boolean(c))} checked={selectedIds.length > 0 && selectedIds.length === items.length} />
                  </TableHead>
                  <TableHead>Resident</TableHead>
                  <TableHead>RT/RW</TableHead>
                  <TableHead>Blok & No. Rumah</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => {
                  const isExpiredDonation = it.type === 'DONATION' && new Date(it.dueDate) < new Date() && it.status !== 'PAID'
                  const isDisabled = it.status === 'PAID' || it.status === 'SKIPPED' || isExpiredDonation
                  
                  const getRowClassName = () => {
                    if (it.status === 'PAID') return 'bg-green-50'
                    if (it.status === 'SKIPPED') return 'bg-yellow-50'
                    if (isExpiredDonation) return 'bg-gray-50 opacity-60'
                    return ''
                  }
                  
                  return (
                  <TableRow key={it.id} className={getRowClassName()}>
                    <TableCell>
                      <Checkbox 
                        checked={!!selected[it.id]} 
                        onCheckedChange={() => toggle(it.id)} 
                        disabled={isDisabled} 
                      />
                    </TableCell>
                    <TableCell>{it.resident?.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {it.resident?.rt && it.resident?.rw ? (
                          <span className="text-sm font-medium">
                            RT {it.resident.rt.toString().padStart(2, '0')}/RW {it.resident.rw.toString().padStart(2, '0')}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {it.resident?.blok && it.resident?.houseNumber
                        ? `${it.resident.blok} / ${it.resident.houseNumber}`
                        : it.resident?.blok || it.resident?.houseNumber || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                          it.type === 'MONTHLY' ? 'bg-blue-100 text-blue-800' :
                          it.type === 'SPECIAL' ? 'bg-purple-100 text-purple-800' :
                          it.type === 'DONATION' ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {it.type === 'MONTHLY' ? 'IPL' :
                           it.type === 'SPECIAL' ? 'THR' :
                           it.type === 'DONATION' ? 'Sumbangan' :
                           it.type}
                        </span>
                        {isExpiredDonation && <span className="text-red-500 text-xs">(Expired)</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {it.type === 'MONTHLY' && it.period ? (
                          <span>
                            {new Date(0, it.period.month - 1).toLocaleDateString('id-ID', { month: 'long' })} {it.period.year}
                          </span>
                        ) : it.type === 'SPECIAL' ? (
                          <span className="font-medium text-purple-700">THR {it.period?.year || new Date(it.dueDate).getFullYear()}</span>
                        ) : it.type === 'DONATION' ? (
                          <span className="text-orange-700">
                            {it.label} • {it.period?.year || new Date(it.dueDate).getFullYear()}
                          </span>
                        ) : (
                          it.period?.name || '-'
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className={isExpiredDonation ? 'text-red-500 font-semibold' : ''}>
                        {format(new Date(it.dueDate), 'dd MMM yyyy')}
                        {it.type === 'DONATION' && (
                          <div className="text-xs text-muted-foreground">
                            {isExpiredDonation ? 'Tidak dapat dipilih' : 'Sukarela'}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={
                        it.status === 'PAID' ? 'text-green-600 font-semibold' :
                        it.status === 'SKIPPED' ? 'text-yellow-600 font-semibold' :
                        isExpiredDonation ? 'text-red-500' : ''
                      }>
                        {it.status === 'PAID' ? 'DIBAYAR' :
                         it.status === 'SKIPPED' ? 'DILEWATI' :
                         it.status === 'PLANNED' ? 'TERJADWAL' :
                         it.status === 'OPTIONAL' ? 'OPSIONAL' :
                         it.status}
                      </span>
                    </TableCell>
                    <TableCell>{it.amount.toLocaleString('id-ID')}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog('single', it.id)}
                          disabled={isDisabled}
                          title="Edit nominal"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteScheduleItem(it.id)}
                          disabled={deleteLoading === it.id}
                          title="Hapus item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  )
                })}
                {items.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        {hasActiveFilters() || searchTerm ? (
                          <>
                            <Search className="h-12 w-12 text-gray-400" />
                            <div className="text-center">
                              <p className="text-lg font-medium text-gray-900">Tidak ada hasil ditemukan</p>
                              <p className="text-sm text-gray-600 mt-1">
                                Coba ubah filter atau kata kunci pencarian
                              </p>
                              <Button
                                variant="outline"
                                onClick={clearFilters}
                                className="mt-3"
                              >
                                Clear semua filter
                              </Button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center">
                              <Search className="h-6 w-6 text-gray-400" />
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-medium text-gray-900">Belum ada jadwal</p>
                              <p className="text-sm text-gray-600 mt-1">
                                Mulai dengan generate jadwal pembayaran baru
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            
            {/* Search Results Info */}
            {(hasActiveFilters() || searchTerm) && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 text-sm text-blue-800">
                  <Search className="h-4 w-4" />
                  <span>
                    Menampilkan {pagination.total} hasil
                    {searchTerm && ` untuk "${searchTerm}"`}
                    {hasActiveFilters() && ' dengan filter aktif'}
                  </span>
                </div>
              </div>
            )}
            
            {/* Loading State */}
            {loading && (
              <div className="mt-4 flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Memuat data...</span>
              </div>
            )}

            {/* Grid footer with pagination controls */}
            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              {/* Left: page size selector */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Rows per page:</span>
                <select
                  value={pagination.limit}
                  onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-muted-foreground">
                  Showing {startIndex}-{endIndex} of {pagination.total}
                </span>
              </div>

              {/* Right: pager + jump to page */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                >
                  Previous
                </Button>
                <div className="text-sm text-muted-foreground">Page {pagination.page} of {pagination.totalPages}</div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                >
                  Next
                </Button>
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-muted-foreground">Go to</span>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, pagination.totalPages)}
                    defaultValue={pagination.page}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const target = e.target as HTMLInputElement
                        const val = Math.min(Math.max(1, parseInt(target.value || '1')), Math.max(1, pagination.totalPages))
                        handlePageChange(val)
                      }
                    }}
                    className="h-8 w-16 rounded-md border border-input bg-background px-2 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


