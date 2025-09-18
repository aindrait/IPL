// Simple in-memory cache for dashboard data
interface CacheEntry {
  data: any
  timestamp: number
  ttl: number // Time to live in milliseconds
}

class DashboardCache {
  private cache = new Map<string, CacheEntry>()
  private readonly DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes

  set(key: string, data: any, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  get(key: string): any | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  clear(): void {
    this.cache.clear()
  }

  // Generate cache key based on request parameters
  generateKey(userId?: string, additionalParams?: Record<string, any>): string {
    const baseKey = 'dashboard'
    const userPart = userId ? `_${userId}` : ''
    const paramsPart = additionalParams ? `_${JSON.stringify(additionalParams)}` : ''
    return `${baseKey}${userPart}${paramsPart}`
  }
}

export const dashboardCache = new DashboardCache()