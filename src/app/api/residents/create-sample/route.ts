import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const sampleResidents = [
  {
    name: 'Budi Santoso',
    address: 'Jl. Merdeka No. 10',
    phone: '081234567890',
    email: 'budi@email.com',
    rt: 1,
    rw: 1
  },
  {
    name: 'Siti Aminah',
    address: 'Jl. Sudirman No. 15',
    phone: '081234567891',
    email: 'siti@email.com',
    rt: 1,
    rw: 1
  },
  {
    name: 'Ahmad Wijaya',
    address: 'Jl. Gatot Subroto No. 20',
    phone: '081234567892',
    email: 'ahmad@email.com',
    rt: 2,
    rw: 1
  },
  {
    name: 'Dewi Lestari',
    address: 'Jl. Thamrin No. 25',
    phone: '081234567893',
    email: 'dewi@email.com',
    rt: 2,
    rw: 1
  },
  {
    name: 'Eko Prasetyo',
    address: 'Jl. Hayam Wuruk No. 30',
    phone: '081234567894',
    email: 'eko@email.com',
    rt: 3,
    rw: 1
  },
  {
    name: 'Maya Sari',
    address: 'Jl. Diponegoro No. 35',
    phone: '081234567895',
    email: 'maya@email.com',
    rt: 3,
    rw: 1
  },
  {
    name: 'Rizki Firmansyah',
    address: 'Jl. A. Yani No. 40',
    phone: '081234567896',
    email: 'rizki@email.com',
    rt: 1,
    rw: 1
  },
  {
    name: 'Faisal Rahman',
    address: 'Jl. S. Parman No. 45',
    phone: '081234567897',
    email: 'faisal@email.com',
    rt: 2,
    rw: 1
  },
  {
    name: 'Indah Permata',
    address: 'Jl. Gajah Mada No. 50',
    phone: '081234567898',
    email: 'indah@email.com',
    rt: 3,
    rw: 1
  },
  {
    name: 'Hendra Gunawan',
    address: 'Jl. Pemuda No. 55',
    phone: '081234567899',
    email: 'hendra@email.com',
    rt: 1,
    rw: 1
  }
]

export async function POST() {
  try {
    // Check if residents already exist
    const existingResidents = await db.resident.findMany({
      where: {
        phone: {
          in: sampleResidents.map(r => r.phone)
        }
      }
    })

    if (existingResidents.length > 0) {
      return NextResponse.json({
        message: 'Sample residents already exist',
        existing: existingResidents.length
      })
    }

    // Ensure 'system' user exists
    let systemUser = await db.user.findFirst({
      where: { email: 'system@localhost' }
    })

    if (!systemUser) {
      systemUser = await db.user.create({
        data: {
          email: 'system@localhost',
          name: 'System User',
          role: 'ADMIN'
        }
      })
      console.log('Created system user:', systemUser)
    }

    // Create residents
    const createdResidents = await db.resident.createMany({
      data: sampleResidents.map(r => ({
        ...r,
        createdById: systemUser.id
      }))
    })

    return NextResponse.json({
      message: 'Sample residents created successfully',
      created: createdResidents.count,
      residents: sampleResidents
    })

  } catch (error) {
    console.error('Error creating sample residents:', error)
    return NextResponse.json(
      { error: 'Failed to create sample residents' },
      { status: 500 }
    )
  }
}