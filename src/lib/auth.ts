import bcrypt from 'bcryptjs'
import { db } from './db'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export async function getUserByEmail(email: string) {
  return db.user.findUnique({
    where: { email },
  })
}

export async function createUser(email: string, name: string, password: string, role = 'READER') {
  const hashedPassword = await hashPassword(password)

  return db.user.create({
    data: {
      email,
      name,
      password: hashedPassword as any,
      role: role as any,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  })
}

export async function updateUserPassword(userId: string, newPassword: string) {
  const hashedPassword = await hashPassword(newPassword)

  return db.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword as any,
    },
  })
}