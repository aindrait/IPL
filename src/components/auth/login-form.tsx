'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorDisplay, FormFieldError } from '@/components/ui/error-display'
import { LoadingSpinner } from '@/components/ui/loading-states'
import { useZodFormValidation, createValidationSchemas } from '@/lib/form-validation'
import { postWithHandling } from '@/lib/api-utils'
import { Loader2 } from 'lucide-react'

interface LoginFormProps {
  onLoginSuccess?: (user: any) => void
  onRegisterClick?: () => void
}

export function LoginForm({ onLoginSuccess, onRegisterClick }: LoginFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Use form validation hook
  const {
    values,
    errors,
    handleChange,
    handleSubmit,
    getFieldError,
    hasFieldError,
  } = useZodFormValidation(
    createValidationSchemas.auth.login,
    { email: '', password: '' }
  )

  const handleFormSubmit = async () => {
    setIsLoading(true)
    setError('')

    try {
      const data = await postWithHandling('/api/auth/login', values)
      
      // Store user in localStorage for simple session management
      localStorage.setItem('user', JSON.stringify((data as any).user))
      onLoginSuccess?.((data as any).user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Login</CardTitle>
        <CardDescription>
          Enter your email and password to access the system.
        </CardDescription>
      </CardHeader>
      <form onSubmit={(e) => {
        e.preventDefault()
        handleSubmit(handleFormSubmit)
      }}>
        <CardContent className="space-y-4">
          {error && <ErrorDisplay message={error} />}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={values.email}
              onChange={(e) => handleChange('email', e.target.value)}
              required
            />
            {hasFieldError('email') && <FormFieldError error={getFieldError('email')} />}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={values.password}
              onChange={(e) => handleChange('password', e.target.value)}
              required
            />
            {hasFieldError('password') && <FormFieldError error={getFieldError('password')} />}
          </div>          
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Please wait
              </>
            ) : (
              'Login'
            )}
          </Button>
          {onRegisterClick && (
            <Button
              type="button"
              variant="link"
              className="w-full"
              onClick={onRegisterClick}
            >
              Don't have an account? Register
            </Button>
          )}
        </CardFooter>
      </form>
    </Card>
  )
}