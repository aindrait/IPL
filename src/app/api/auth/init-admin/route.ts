import { NextRequest, NextResponse } from 'next/server'
import { createUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST() {
  try {
    // Check if admin user already exists
    const existingAdmin = await db.user.findUnique({
      where: { email: 'admin@example.com' }
    })

    if (existingAdmin) {
      return NextResponse.json({
        message: 'Admin user already exists',
        user: {
          id: existingAdmin.id,
          email: existingAdmin.email,
          name: existingAdmin.name,
          role: existingAdmin.role
        }
      })
    }

    // Create admin user
    const adminUser = await createUser('admin@example.com', 'Admin User', 'admin123', 'ADMIN')

    return NextResponse.json({
      message: 'Admin user created successfully',
      user: adminUser
    })
  } catch (error) {
    console.error('Init admin error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}