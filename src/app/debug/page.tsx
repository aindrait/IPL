'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Database, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  Users,
  Calendar,
  DollarSign
} from 'lucide-react'

interface DebugInfo {
  status: string
  counts: {
    residents: number
    periods: number
    payments: number
  }
  samples: {
    resident?: any
    period?: any
  }
  error?: string
}

export default function DebugPage() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchDebugInfo = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/debug')
      const data = await response.json()
      setDebugInfo(data)
    } catch (error) {
      setDebugInfo({
        status: 'error',
        counts: { residents: 0, periods: 0, payments: 0 },
        samples: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDebugInfo()
  }, [])

  const createSampleData = async () => {
    try {
      const response = await fetch('/api/periods/create-sample', {
        method: 'POST',
      })
      
      if (response.ok) {
        await fetchDebugInfo()
        alert('Sample data berhasil dibuat!')
      } else {
        const error = await response.json()
        alert(`Gagal membuat sample data: ${error.error}`)
      }
    } catch (error) {
      alert(`Gagal membuat sample data: ${error}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Debug Database</h1>
          <p className="text-muted-foreground">
            Cek koneksi database dan data sample
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchDebugInfo} disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={createSampleData} disabled={loading}>
            <Database className="w-4 h-4 mr-2" />
            Buat Sample Data
          </Button>
        </div>
      </div>

      {debugInfo?.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Error: {debugInfo.error}
          </AlertDescription>
        </Alert>
      )}

      {debugInfo?.status === 'Database connected successfully' && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Database connected successfully!
          </AlertDescription>
        </Alert>
      )}

      {/* Database Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Status
          </CardTitle>
          <CardDescription>
            Status koneksi dan jumlah records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                <span className="font-medium">Residents</span>
              </div>
              <Badge variant="outline">{debugInfo?.counts.residents || 0}</Badge>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-green-500" />
                <span className="font-medium">Periods</span>
              </div>
              <Badge variant="outline">{debugInfo?.counts.periods || 0}</Badge>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-purple-500" />
                <span className="font-medium">Payments</span>
              </div>
              <Badge variant="outline">{debugInfo?.counts.payments || 0}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sample Data */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sample Resident</CardTitle>
            <CardDescription>
              Contoh data warga di database
            </CardDescription>
          </CardHeader>
          <CardContent>
            {debugInfo?.samples.resident ? (
              <pre className="text-sm bg-gray-50 p-4 rounded overflow-auto">
                {JSON.stringify(debugInfo.samples.resident, null, 2)}
              </pre>
            ) : (
              <p className="text-muted-foreground">No resident data found</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sample Period</CardTitle>
            <CardDescription>
              Contoh data periode di database
            </CardDescription>
          </CardHeader>
          <CardContent>
            {debugInfo?.samples.period ? (
              <pre className="text-sm bg-gray-50 p-4 rounded overflow-auto">
                {JSON.stringify(debugInfo.samples.period, null, 2)}
              </pre>
            ) : (
              <p className="text-muted-foreground">No period data found</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>
            Aksi untuk testing dan maintenance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button onClick={createSampleData} disabled={loading}>
              <Database className="w-4 h-4 mr-2" />
              Create Sample Data
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/'}>
              Back to Dashboard
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/residents'}>
              Manage Residents
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/payments'}>
              Manage Payments
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}