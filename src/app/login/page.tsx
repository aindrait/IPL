'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LoginForm } from '@/components/auth/login-form'
import { RegisterForm } from '@/components/auth/register-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState('login')
  const router = useRouter()

  useEffect(() => {
    // Check if user is already logged in
    const user = localStorage.getItem('user')
    if (user) {
      router.push('/')
    }
  }, [router])

  const handleLoginSuccess = (user: any) => {
    router.push('/')
  }

  const handleRegisterSuccess = (user: any) => {
    setActiveTab('login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold">
            IPL Management System
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to your account or create a new one
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>
          
          <TabsContent value="login" className="mt-6">
            <LoginForm 
              onLoginSuccess={handleLoginSuccess}
              onRegisterClick={() => setActiveTab('register')}
            />
          </TabsContent>
          
          <TabsContent value="register" className="mt-6">
            <RegisterForm 
              onRegisterSuccess={handleRegisterSuccess}
              onLoginClick={() => setActiveTab('login')}
            />
          </TabsContent>
        </Tabs>

        {process.env.NODE_ENV === 'development' && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Default Admin Account</CardTitle>
              <CardDescription>
                Use these credentials to login as an administrator:
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div><strong>Email:</strong> admin@example.com</div>
                <div><strong>Password:</strong> admin123</div>
              </div>
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={async () => {
                  try {
                    await fetch('/api/auth/init-admin', { method: 'POST' })
                    alert('Admin user initialized successfully!')
                  } catch (error) {
                    alert('Failed to initialize admin user')
                  }
                }}
              >
                Initialize Admin User
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}