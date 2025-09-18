import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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

const defaultSettings: PaymentSettings = {
  defaultAmount: parseInt((process.env.NEXT_PUBLIC_IPL_BASE_AMOUNT || "250000").split(',')[0], 10) || 250000,
  dueDate: parseInt(process.env.NEXT_PUBLIC_DEFAULT_DUE_DATE || "5", 10) || 5,
  rwSettings: {
    activeRWs: [12],
    defaultRW: 12
  },
  bankAccount: {
    bank: 'BCA',
    accountNumber: '6050613567',
    accountName: 'YUPITHER BOUK'
  }
}

export async function GET() {
  try {
    // Get all settings
    const settings = await db.settings.findMany()
    
    // Convert to key-value object
    const settingsObj: Record<string, any> = {}
    settings.forEach(setting => {
      try {
        settingsObj[setting.key] = JSON.parse(setting.value)
      } catch {
        settingsObj[setting.key] = setting.value
      }
    })
    
    // Merge with defaults
    const paymentSettings = {
      ...defaultSettings,
      ...settingsObj.paymentSettings
    }
    
    return NextResponse.json({
      paymentSettings
    })
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json({ error: 'Gagal mengambil pengaturan' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { paymentSettings } = body
    
    if (paymentSettings) {
      // Validate payment settings
      if (typeof paymentSettings.defaultAmount !== 'number' || paymentSettings.defaultAmount <= 0) {
        return NextResponse.json({ error: 'Default amount harus berupa angka positif' }, { status: 400 })
      }
      
      if (typeof paymentSettings.dueDate !== 'number' || paymentSettings.dueDate < 1 || paymentSettings.dueDate > 31) {
        return NextResponse.json({ error: 'Due date harus antara 1 dan 31' }, { status: 400 })
      }
      
      if (!paymentSettings.bankAccount?.bank || !paymentSettings.bankAccount?.accountNumber || !paymentSettings.bankAccount?.accountName) {
        return NextResponse.json({ error: 'Informasi rekening bank tidak lengkap' }, { status: 400 })
      }
      
      // Save payment settings
      await db.settings.upsert({
        where: { key: 'paymentSettings' },
        update: { value: JSON.stringify(paymentSettings) },
        create: { key: 'paymentSettings', value: JSON.stringify(paymentSettings) }
      })
    }
    
    return NextResponse.json({ message: 'Pengaturan berhasil disimpan' })
  } catch (error) {
    console.error('Error saving settings:', error)
    return NextResponse.json({ error: 'Gagal menyimpan pengaturan' }, { status: 500 })
  }
}