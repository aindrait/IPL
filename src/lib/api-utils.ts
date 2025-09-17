import { useState } from 'react'
import { toast } from '@/hooks/use-toast'

// API response interface
export interface ApiResponse<T = any> {
  data?: T
  error?: string
  message?: string
  details?: any
}

// Standardized API error class
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Utility function to handle API responses
export async function handleApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorData: any = {}
    
    try {
      errorData = await response.json()
    } catch (e) {
      // If we can't parse the error as JSON, use the status text
      throw new ApiError(
        response.statusText || 'An error occurred',
        response.status
      )
    }
    
    throw new ApiError(
      errorData.error || errorData.message || 'An error occurred',
      response.status,
      errorData.details || errorData
    )
  }
  
  return response.json()
}

// Utility function for making API requests with error handling
export async function fetchWithHandling<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    })

    return await handleApiResponse<T>(response)
  } catch (error) {
    if (error instanceof ApiError) {
      // Show user-friendly error message
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
      throw error
    } else {
      // Handle unexpected errors
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
      throw new Error(errorMessage)
    }
  }
}

// Utility function for making POST requests
export async function postWithHandling<T>(
  url: string,
  data: any,
  options?: RequestInit
): Promise<T> {
  return fetchWithHandling<T>(url, {
    method: 'POST',
    body: JSON.stringify(data),
    ...options,
  })
}

// Utility function for making PUT requests
export async function putWithHandling<T>(
  url: string,
  data: any,
  options?: RequestInit
): Promise<T> {
  return fetchWithHandling<T>(url, {
    method: 'PUT',
    body: JSON.stringify(data),
    ...options,
  })
}

// Utility function for making DELETE requests
export async function deleteWithHandling<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  return fetchWithHandling<T>(url, {
    method: 'DELETE',
    ...options,
  })
}

// Utility function for file uploads
export async function uploadWithHandling<T>(
  url: string,
  formData: FormData,
  options?: RequestInit
): Promise<T> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      // Don't set Content-Type header for FormData, browser will set it with boundary
      ...options,
    })

    return await handleApiResponse<T>(response)
  } catch (error) {
    if (error instanceof ApiError) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
      throw error
    } else {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during upload'
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
      throw new Error(errorMessage)
    }
  }
}

// Hook for API calls with loading state and error handling
export function useApi<T>() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const execute = async (
    apiCall: () => Promise<T>,
    onSuccess?: (data: T) => void,
    onError?: (error: Error) => void
  ): Promise<T | null> => {
    setLoading(true)
    setError(null)

    try {
      const result = await apiCall()
      onSuccess?.(result)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      onError?.(err instanceof Error ? err : new Error(errorMessage))
      return null
    } finally {
      setLoading(false)
    }
  }

  return { loading, error, execute }
}