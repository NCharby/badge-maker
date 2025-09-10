/**
 * Cookie utilities for managing client-side cookies
 */

export interface CookieOptions {
  expires?: Date;
  maxAge?: number; // seconds
  path?: string;
  domain?: string;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

/**
 * Set a cookie with the given name and value
 */
export function setCookie(name: string, value: string, options: CookieOptions = {}): void {
  if (typeof document === 'undefined') {
    console.warn('setCookie called in non-browser environment');
    return;
  }

  const {
    expires,
    maxAge,
    path = '/',
    domain,
    secure,
    sameSite = 'Strict'
  } = options;

  let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

  if (expires) {
    cookieString += `; expires=${expires.toUTCString()}`;
  }

  if (maxAge !== undefined) {
    cookieString += `; max-age=${maxAge}`;
  }

  cookieString += `; path=${path}`;

  if (domain) {
    cookieString += `; domain=${domain}`;
  }

  if (secure) {
    cookieString += `; secure`;
  }

  cookieString += `; SameSite=${sameSite}`;

  document.cookie = cookieString;
}

/**
 * Get a cookie value by name
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    console.warn('getCookie called in non-browser environment');
    return null;
  }

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${encodeURIComponent(name)}=`);
  
  if (parts.length === 2) {
    const cookieValue = parts.pop()?.split(';').shift();
    return cookieValue ? decodeURIComponent(cookieValue) : null;
  }
  
  return null;
}

/**
 * Check if a cookie exists
 */
export function hasCookie(name: string): boolean {
  return getCookie(name) !== null;
}

/**
 * Delete a cookie by name
 */
export function deleteCookie(name: string, options: Omit<CookieOptions, 'expires' | 'maxAge'> = {}): void {
  setCookie(name, '', {
    ...options,
    expires: new Date(0)
  });
}

/**
 * Email-specific cookie utilities
 */
export const emailCookies = {
  /**
   * Check if confirmation email has been sent for a specific badge
   */
  hasEmailBeenSent(badgeId: string): boolean {
    const cookieName = `badge-email-sent-${badgeId}`;
    return hasCookie(cookieName);
  },

  /**
   * Mark confirmation email as sent for a specific badge
   */
  markEmailAsSent(badgeId: string, expiryDays: number = 30): void {
    const cookieName = `badge-email-sent-${badgeId}`;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + expiryDays);
    
    setCookie(cookieName, 'true', {
      expires: expiryDate,
      path: '/',
      sameSite: 'Strict'
    });
  },

  /**
   * Clear email sent status for a specific badge (useful for testing)
   */
  clearEmailStatus(badgeId: string): void {
    const cookieName = `badge-email-sent-${badgeId}`;
    deleteCookie(cookieName);
  }
};
