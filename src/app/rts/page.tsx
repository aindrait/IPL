'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Trash2, Edit, Plus, Users } from 'lucide-react'

type RT = {
  id: string
  number: number
  rw: number
  chairman: string | null
  phone: string | null
  is_active: boolean
  residents: Array<{
    id: string
    name: string | null
    blok: string | null
    house_number: string | null
    is_active: boolean
  }>
}

export default function RTsPage() {
  const [rts, setRTs] = useState<RT[]>([])
  const [loading, setLoading] = useState(false)
  const [openDialog, setOpenDialog] = useState(false)
  const [editingRT, setEditingRT] = useState<RT | null>(null)
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
  
  // Form state
  const [number, setNumber] = useState('')
  const [rw, setRW] = useState('')
  const [chairman, setChairman] = useState('')
  const [phone, setPhone] = useState('')
  const [is_active, setIsActive] = useState(true)

  const fetchRTs = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/rts')
      const data = await res.json()
      setRTs(data.rts || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRTs()
  }, [])

  const resetForm = () => {
    setNumber('')
    setRW('')
    setChairman('')
    setPhone('')
    setIsActive(true)
    setEditingRT(null)
  }

  const handleSubmit = async () => {
    if (!number || !rw) {
      alert('Nomor RT dan RW harus diisi')
      return
    }

    const payload = {
      number: parseInt(number),
      rw: parseInt(rw),
      chairman: chairman || null,
      phone: phone || null,
      is_active,
    }

    try {
      if (editingRT) {
        await fetch(`/api/rts/${editingRT.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        await fetch('/api/rts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }
      
      setOpenDialog(false)
      resetForm()
      fetchRTs()
    } catch (error) {
      console.error('Error saving RT:', error)
      alert('Gagal menyimpan data RT')
    }
  }

  const handleEdit = (rt: RT) => {
    setEditingRT(rt)
    setNumber(rt.number.toString())
    setRW(rt.rw.toString())
    setChairman(rt.chairman || '')
    setPhone(rt.phone || '')
    setIsActive(rt.is_active)
    setOpenDialog(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus data RT ini?')) {
      return
    }
    
    setDeleteLoading(id)
    try {
      await fetch(`/api/rts/${id}`, {
        method: 'DELETE',
      })
      fetchRTs()
    } catch (error) {
      console.error('Error deleting RT:', error)
      alert('Gagal menghapus data RT')
    } finally {
      setDeleteLoading(null)
    }
  }

  const openNewDialog = () => {
    resetForm()
    setOpenDialog(true)
  }

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Manajemen RT</CardTitle>
          <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogTrigger asChild>
              <Button onClick={openNewDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Tambah RT
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingRT ? 'Edit RT' : 'Tambah RT Baru'}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="number">Nomor RT</Label>
                  <Input
                    id="number"
                    type="number"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder="Masukkan nomor RT"
                  />
                </div>
                <div>
                  <Label htmlFor="rw">Nomor RW</Label>
                  <Input
                    id="rw"
                    type="number"
                    value={rw}
                    onChange={(e) => setRW(e.target.value)}
                    placeholder="Masukkan nomor RW"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="chairman">Ketua RT</Label>
                  <Input
                    id="chairman"
                    value={chairman}
                    onChange={(e) => setChairman(e.target.value)}
                    placeholder="Masukkan nama ketua RT"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="phone">No. Telepon</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Masukkan nomor telepon"
                  />
                </div>
                <div className="col-span-2 flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={is_active}
                    onCheckedChange={setIsActive}
                  />
                  <Label htmlFor="is_active">Aktif</Label>
                </div>
              </div>
              <div className="mt-4 flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setOpenDialog(false)}>
                  Batal
                </Button>
                <Button onClick={handleSubmit}>
                  {editingRT ? 'Update' : 'Simpan'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nomor</TableHead>
                  <TableHead>RW</TableHead>
                  <TableHead>Ketua RT</TableHead>
                  <TableHead>No. Telepon</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Warga</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rts.map((rt) => (
                  <TableRow key={rt.id}>
                    <TableCell>{rt.number}</TableCell>
                    <TableCell>{rt.rw}</TableCell>
                    <TableCell>{rt.chairman || '-'}</TableCell>
                    <TableCell>{rt.phone || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={rt.is_active ? 'default' : 'secondary'}>
                        {rt.is_active ? 'Aktif' : 'Tidak Aktif'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Users className="h-4 w-4" />
                        <span>{rt.residents ? rt.residents.filter(r => r.is_active).length : 0}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(rt)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(rt.id)}
                          disabled={deleteLoading === rt.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {rts.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                      No RT data
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}