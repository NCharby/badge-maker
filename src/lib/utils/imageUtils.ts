/**
 * Utility functions for handling secure image access with signed URLs
 */

export async function getSignedImageUrl(filename: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/images/${encodeURIComponent(filename)}`)
    
    if (response.ok) {
      const data = await response.json()
      return data.url
    } else {
      console.error('Failed to get signed URL:', response.statusText)
      return null
    }
  } catch (error) {
    console.error('Error getting signed URL:', error)
    return null
  }
}

export function isSignedUrl(url: string): boolean {
  return url.includes('?token=') || url.includes('&token=')
}

export function isExpiredSignedUrl(url: string): boolean {
  // Check if URL has an expiry parameter and if it's expired
  const urlParams = new URLSearchParams(url.split('?')[1] || '')
  const expiresAt = urlParams.get('expires')
  
  if (!expiresAt) return false
  
  return new Date(parseInt(expiresAt) * 1000) < new Date()
}
