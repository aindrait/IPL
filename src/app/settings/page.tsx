'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Settings, Save } from 'lucide-react'

interface PaymentSettings {
  defaultAmount: number
  dueDate: number
  rwSettings: {
    activeRWs: number[]
    defaultRW: number
  }
  bankAccount: {
    bank: string
    accountNumber: string
    accountName: string
  }
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<PaymentSettings>({
    defaultAmount: 250000,
    dueDate: 5,
    rwSettings: {
      activeRWs: [12],
      defaultRW: 12
    },
    bankAccount: {
      bank: 'BCA',
      accountNumber: '6050613567',
      accountName: 'YUPITHER BOUK'
    }
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/settings')
      const data = await response.json()
      if (data.paymentSettings) {
        setSettings(data.paymentSettings)
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
      setError('Gagal mengambil pengaturan')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paymentSettings: settings }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Gagal menyimpan pengaturan')
      }

      setSuccess('Pengaturan berhasil disimpan')
    } catch (error) {
      console.error('Error saving settings:', error)
      setError(error instanceof Error ? error.message : 'Gagal menyimpan pengaturan')
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="h-32 bg-gray-200 rounded mb-4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Settings className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pengaturan Sistem</h1>
          <p className="text-muted-foreground">Kelola pengaturan default untuk pembayaran IPL</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pengaturan Pembayaran Default</CardTitle>
          <CardDescription>
            Konfigurasi nilai default untuk pembayaran IPL dan informasi rekening bank
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="defaultAmount">Nominal IPL Default</Label>
                <Input
                  id="defaultAmount"
                  type="number"
                  value={settings.defaultAmount}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    defaultAmount: parseInt(e.target.value) || 0
                  }))}
                  min="0"
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Contoh: 250000 (akan ditampilkan sebagai {formatCurrency(250000)})
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate">Tanggal Jatuh Tempo</Label>
                <Input
                  id="dueDate"
                  type="number"
                  value={settings.dueDate}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    dueDate: parseInt(e.target.value) || 1
                  }))}
                  min="1"
                  max="31"
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Tanggal jatuh tempo pembayaran setiap bulan (1-31)
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Pengaturan RW</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="defaultRW">RW Default</Label>
                  <Input
                    id="defaultRW"
                    type="number"
                    value={settings.rwSettings.defaultRW}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      rwSettings: {
                        ...prev.rwSettings,
                        defaultRW: parseInt(e.target.value) || 1
                      }
                    }))}
                    min="1"
                    max="20"
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    RW default yang digunakan untuk pembuatan jadwal
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="activeRWs">RW Aktif (pisahkan dengan koma)</Label>
                  <Input
                    id="activeRWs"
                    type="text"
                    value={settings.rwSettings.activeRWs.join(', ')}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      rwSettings: {
                        ...prev.rwSettings,
                        activeRWs: e.target.value.split(',').map(rw => parseInt(rw.trim())).filter(rw => !isNaN(rw))
                      }
                    }))}
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    Contoh: 12, 13 (RW yang aktif dalam sistem)
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Informasi Rekening Bank</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bank">Bank</Label>
                  <Input
                    id="bank"
                    value={settings.bankAccount.bank}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      bankAccount: {
                        ...prev.bankAccount,
                        bank: e.target.value
                      }
                    }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Nomor Rekening</Label>
                  <Input
                    id="accountNumber"
                    value={settings.bankAccount.accountNumber}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      bankAccount: {
                        ...prev.bankAccount,
                        accountNumber: e.target.value
                      }
                    }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accountName">Atas Nama</Label>
                  <Input
                    id="accountName"
                    value={settings.bankAccount.accountName}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      bankAccount: {
                        ...prev.bankAccount,
                        accountName: e.target.value
                      }
                    }))}
                    required
                  />
                </div>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}