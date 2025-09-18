import { NextRequest, NextResponse } from 'next/server'
import { getUserByEmail, verifyPassword } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

// Login validation schema
const loginSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(1, 'Password harus diisi'),
})

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json()
    
    // Validate input
    const validatedData = loginSchema.safeParse(body)
    if (!validatedData.success) {
      return NextResponse.json(
        {
          error: 'Validasi gagal',
          details: validatedData.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      )
    }

    const { email, password } = validatedData.data

    // Find user by email with password included
    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        password: true as any,
        created_at: true,
        updated_at: true
      }
    })

    if (!user || !(user as any).password) {
      return NextResponse.json(
        { error: 'Email atau password tidak valid' },
        { status: 401 }
      )
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, (user as any).password)

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Email atau password tidak valid' },
        { status: 401 }
      )
    }

    // Update last login time
    await db.user.update({
      where: { id: user.id },
      data: { updated_at: new Date() }
    })

    // Return user data without password
    const { password: _, ...userWithoutPassword } = user as any

    // In a real app, you would set up a session token here
    // For now, we'll just return the user data
    return NextResponse.json({
      message: 'Login berhasil',
      user: userWithoutPassword
    })
  } catch (error) {
    console.error('Login error:', error)
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('JSON')) {
        return NextResponse.json(
          { error: 'Format request tidak valid' },
          { status: 400 }
        )
      }
      
      if (error.message.includes('database') || error.message.includes('prisma')) {
        return NextResponse.json(
          { error: 'Kesalahan database', details: error.message },
          { status: 500 }
        )
      }
    }
    
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}