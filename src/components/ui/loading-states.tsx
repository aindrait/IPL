import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  }

  return (
    <div className={cn('flex justify-center items-center', className)}>
      <div className={cn('animate-spin rounded-full border-b-2 border-primary', sizeClasses[size])}></div>
    </div>
  )
}

export interface LoadingCardProps {
  className?: string
  lines?: number
  showHeader?: boolean
}

export function LoadingCard({ className, lines = 4, showHeader = true }: LoadingCardProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {showHeader && (
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
      )}
      <div className="space-y-4">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    </div>
  )
}

export interface LoadingTableProps {
  rows?: number
  columns?: number
  className?: string
  showHeader?: boolean
}

export function LoadingTable({ rows = 5, columns = 5, className, showHeader = true }: LoadingTableProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {showHeader && (
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      )}
      <div className="rounded-md border">
        <div className="space-y-0">
          {/* Table Header */}
          <div className="flex border-b">
            {Array.from({ length: columns }).map((_, i) => (
              <div key={`header-${i}`} className="p-2 flex-1">
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
          {/* Table Rows */}
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={`row-${rowIndex}`} className="flex border-b">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <div key={`cell-${rowIndex}-${colIndex}`} className="p-2 flex-1">
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export interface LoadingFormProps {
  fields?: number
  className?: string
  showActions?: boolean
}

export function LoadingForm({ fields = 5, className, showActions = true }: LoadingFormProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="grid grid-cols-4 items-center gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 col-span-3" />
        </div>
      ))}
      {showActions && (
        <div className="flex justify-end">
          <Skeleton className="h-10 w-24" />
        </div>
      )}
    </div>
  )
}

export interface LoadingProps {
  type?: 'spinner' | 'card' | 'table' | 'form'
  className?: string
  // Props for specific loading types
  spinnerSize?: 'sm' | 'md' | 'lg'
  cardLines?: number
  cardShowHeader?: boolean
  tableRows?: number
  tableColumns?: number
  tableShowHeader?: boolean
  formFields?: number
  formShowActions?: boolean
}

export function Loading({
  type = 'spinner',
  className,
  spinnerSize = 'md',
  cardLines = 4,
  cardShowHeader = true,
  tableRows = 5,
  tableColumns = 5,
  tableShowHeader = true,
  formFields = 5,
  formShowActions = true
}: LoadingProps) {
  switch (type) {
    case 'spinner':
      return <LoadingSpinner size={spinnerSize} className={className} />
    case 'card':
      return <LoadingCard className={className} lines={cardLines} showHeader={cardShowHeader} />
    case 'table':
      return <LoadingTable 
        className={className} 
        rows={tableRows} 
        columns={tableColumns} 
        showHeader={tableShowHeader} 
      />
    case 'form':
      return <LoadingForm 
        className={className} 
        fields={formFields} 
        showActions={formShowActions} 
      />
    default:
      return <LoadingSpinner size={spinnerSize} className={className} />
  }
}

export interface LoadingOverlayProps {
  isLoading: boolean
  message?: string
  className?: string
  children: React.ReactNode
}

export function LoadingOverlay({ 
  isLoading, 
  message = 'Memuat...', 
  className, 
  children 
}: LoadingOverlayProps) {
  return (
    <div className={cn('relative', className)}>
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center z-50">
          <LoadingSpinner size="lg" />
          {message && <p className="mt-4 text-sm text-muted-foreground">{message}</p>}
        </div>
      )}
    </div>
  )
}

export interface PageLoadingProps {
  message?: string
  className?: string
}

export function PageLoading({ message = 'Memuat halaman...', className }: PageLoadingProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center min-h-screen', className)}>
      <LoadingSpinner size="lg" />
      <p className="mt-4 text-lg text-muted-foreground">{message}</p>
    </div>
  )
}