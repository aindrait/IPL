import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST() {
  try {
    // Check if 'system' user already exists
    let systemUser = await db.user.findFirst({
      where: { email: 'system@localhost' }
    })

    if (!systemUser) {
      // Create the 'system' user
      systemUser = await db.user.create({
        data: {
          email: 'system@localhost',
          name: 'System User',
          role: 'ADMIN'
        }
      })
      console.log('Created system user:', systemUser)
    } else {
      console.log('System user already exists:', systemUser)
    }

    return NextResponse.json({
      message: 'System user initialized successfully',
      user: {
        id: systemUser.id,
        email: systemUser.email,
        name: systemUser.name,
        role: systemUser.role
      }
    })
  } catch (error) {
    console.error('Error initializing system user:', error)
    return NextResponse.json(
      { error: 'Failed to initialize system user', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}