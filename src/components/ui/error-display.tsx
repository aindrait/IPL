import React from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, Info, CheckCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ErrorDisplayProps {
  title?: string
  message: string
  variant?: 'default' | 'destructive'
  className?: string
  icon?: React.ReactNode
  actions?: React.ReactNode
}

export function ErrorDisplay({
  title,
  message,
  variant = 'destructive',
  className,
  icon,
  actions
}: ErrorDisplayProps) {
  const getVariantIcon = () => {
    if (icon) return icon
    
    switch (variant) {
      case 'destructive':
        return <XCircle className="h-4 w-4" />
      default:
        return <AlertCircle className="h-4 w-4" />
    }
  }

  return (
    <Alert className={cn('mb-4', className)} variant={variant}>
      {getVariantIcon()}
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription className="flex flex-col gap-2">
        <span>{message}</span>
        {actions && <div className="mt-2">{actions}</div>}
      </AlertDescription>
    </Alert>
  )
}

export interface FormFieldErrorProps {
  error?: string
  className?: string
}

export function FormFieldError({ error, className }: FormFieldErrorProps) {
  if (!error) return null
  
  return (
    <p className={cn('text-sm font-medium text-destructive mt-1', className)}>
      {error}
    </p>
  )
}

export interface ApiErrorProps {
  error: Error | string | null | undefined
  className?: string
  onRetry?: () => void
  retryText?: string
}

export function ApiError({ 
  error, 
  className, 
  onRetry, 
  retryText = 'Coba Lagi' 
}: ApiErrorProps) {
  if (!error) return null
  
  const errorMessage = typeof error === 'string' ? error : error.message
  
  return (
    <ErrorDisplay
      title="Terjadi Kesalahan"
      message={errorMessage}
      variant="destructive"
      className={className}
      actions={onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
        >
          {retryText}
        </button>
      )}
    />
  )
}

export interface LoadingErrorProps {
  loading: boolean
  error: Error | string | null | undefined
  className?: string
  children: React.ReactNode
  onRetry?: () => void
  retryText?: string
  loadingComponent?: React.ReactNode
}

export function LoadingError({
  loading,
  error,
  className,
  children,
  onRetry,
  retryText,
  loadingComponent
}: LoadingErrorProps) {
  if (loading) {
    return loadingComponent || (
      <div className={cn('flex justify-center items-center p-8', className)}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }
  
  if (error) {
    return (
      <ApiError
        error={error}
        className={className}
        onRetry={onRetry}
        retryText={retryText}
      />
    )
  }
  
  return <>{children}</>
}