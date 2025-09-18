import { useState, useEffect } from 'react'
import { z, ZodSchema, ZodError } from 'zod'

export interface FormFieldError {
  field: string
  message: string
}

export interface FormValidationResult<T> {
  data: T | null
  errors: FormFieldError[]
  isValid: boolean
}

// Hook for real-time form validation with Zod
export function useZodFormValidation<T>(
  schema: ZodSchema<T>,
  initialValues: T
) {
  const [values, setValues] = useState<T>(initialValues)
  const [errors, setErrors] = useState<FormFieldError[]>([])
  const [isValid, setIsValid] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  // Validate form data
  const validate = (data: T): FormValidationResult<T> => {
    try {
      const validatedData = schema.parse(data)
      setErrors([])
      setIsValid(true)
      return { data: validatedData, errors: [], isValid: true }
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors = error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message
        }))
        setErrors(fieldErrors)
        setIsValid(false)
        return { data: null, errors: fieldErrors, isValid: false }
      }
      throw error
    }
  }

  // Validate a specific field
  const validateField = (fieldName: keyof T, value: any) => {
    try {
      // Create a partial schema for just this field
      const fieldSchema = z.object({
        [fieldName]: z.any()
      })
      
      fieldSchema.parse({ [fieldName]: value })
      
      // Remove error for this field if it exists
      setErrors(prev => prev.filter(error => error.field !== fieldName.toString()))
      
      return true
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors = error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message
        }))
        
        // Update errors for this field
        setErrors(prev => {
          const otherErrors = prev.filter(error => error.field !== fieldName.toString())
          return [...otherErrors, ...fieldErrors]
        })
        
        return false
      }
      throw error
    }
  }

  // Handle field change with real-time validation
  const handleChange = (fieldName: keyof T, value: any) => {
    const newValues = { ...values, [fieldName]: value }
    setValues(newValues)
    
    // Mark field as touched
    setTouched(prev => ({ ...prev, [fieldName.toString()]: true }))
    
    // Validate field if it has been touched
    if (touched[fieldName.toString()]) {
      validateField(fieldName, value)
    }
  }

  // Handle form submission
  const handleSubmit = (onSubmit: (data: T) => void) => {
    const result = validate(values)
    if (result.isValid && result.data) {
      onSubmit(result.data)
    }
    return result
  }

  // Get error for a specific field
  const getFieldError = (fieldName: keyof T): string | undefined => {
    return errors.find(error => error.field === fieldName.toString())?.message
  }

  // Check if a field has an error
  const hasFieldError = (fieldName: keyof T): boolean => {
    return errors.some(error => error.field === fieldName.toString())
  }

  // Reset form to initial values
  const reset = () => {
    setValues(initialValues)
    setErrors([])
    setIsValid(false)
    setTouched({})
  }

  // Validate entire form on values change
  useEffect(() => {
    // Only validate if all fields have been touched or on initial mount
    const allTouched = Object.keys(initialValues as Record<string, any>).every(key => touched[key])
    if (allTouched || Object.keys(touched).length === 0) {
      validate(values)
    }
  }, [values])

  return {
    values,
    errors,
    isValid,
    touched,
    handleChange,
    handleSubmit,
    getFieldError,
    hasFieldError,
    reset,
    setValues,
    setTouched
  }
}

// Utility to create form validation schemas for common use cases
export const createValidationSchemas = {
  // User authentication schema
  auth: {
    login: z.object({
      email: z.string().email('Email tidak valid'),
      password: z.string().min(6, 'Password minimal 6 karakter'),
    }),
    register: z.object({
      name: z.string().min(1, 'Nama harus diisi'),
      email: z.string().email('Email tidak valid'),
      password: z.string().min(6, 'Password minimal 6 karakter'),
      confirmPassword: z.string(),
    }).refine(data => data.password === data.confirmPassword, {
      message: "Password tidak cocok",
      path: ["confirmPassword"],
    }),
    changePassword: z.object({
      currentPassword: z.string().min(1, 'Password saat ini harus diisi'),
      newPassword: z.string().min(6, 'Password baru minimal 6 karakter'),
      confirmPassword: z.string(),
    }).refine(data => data.newPassword === data.confirmPassword, {
      message: "Password tidak cocok",
      path: ["confirmPassword"],
    }),
  },

  // Resident management schema
  resident: z.object({
    name: z.string().min(1, 'Nama warga harus diisi'),
    address: z.string().min(1, 'Alamat harus diisi'),
    phone: z.string().min(10, 'Nomor telepon minimal 10 digit'),
    email: z.union([
      z.string().email('Email tidak valid'),
      z.literal('').transform(() => undefined)
    ]).optional().nullable(),
    rt: z.number().min(1, 'RT harus diisi').max(20, 'RT maksimal 20'),
    rw: z.number().min(1, 'RW harus diisi').max(20, 'RW maksimal 20'),
    blok: z.string().min(1, 'BLOK harus diisi').optional(),
    house_number: z.string().min(1, 'Nomor rumah harus diisi').optional(),
    payment_index: z.number().min(1, 'Index pembayaran harus lebih dari 0').optional(),
    ownership: z.enum(['MILIK', 'SEWA']).optional().nullable(),
    rt_id: z.string().optional().nullable(),
  }),

  // Payment management schema
  payment: z.object({
    resident_id: z.string().min(1, 'ID warga harus diisi'),
    period_id: z.string().optional(),
    amount: z.number().min(1, 'Jumlah pembayaran harus lebih dari 0'),
    payment_date: z.string().min(1, 'Tanggal pembayaran harus diisi'),
    payment_method: z.string().optional(),
    notes: z.string().nullable().optional(),
    scheduleItemId: z.string().optional(),
  }).refine(data => data.period_id || data.scheduleItemId, {
    message: 'Periode atau item jadwal harus dipilih',
    path: ['period_id'],
  }),

  // RT management schema
  rt: z.object({
    number: z.number().min(1, 'Nomor RT harus diisi').max(20, 'Nomor RT maksimal 20'),
    rw: z.number().min(1, 'RW harus diisi').max(20, 'RW maksimal 20'),
    chairman: z.string().min(1, 'Nama ketua RT harus diisi'),
    address: z.string().optional(),
    phone: z.string().optional(),
  }),

  // Schedule management schema
  schedule: z.object({
    resident_id: z.string().min(1, 'ID warga harus diisi'),
    type: z.enum(['MONTHLY', 'SPECIAL', 'DONATION']),
    amount: z.number().min(0, 'Jumlah harus lebih dari atau sama dengan 0'),
    due_date: z.string().min(1, 'Tanggal jatuh tempo harus diisi'),
    notes: z.string().optional(),
  }),
}