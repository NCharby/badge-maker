/**
 * Profile completeness check — event enrollment gate.
 *
 * Required fields before a user can enroll in any event
 * (submit an application or purchase a ticket):
 *
 *  - first_name          — Legal first name
 *  - last_name           — Legal last name
 *  - emergency_contact   — Emergency contact full name
 *  - emergency_phone     — Emergency contact phone number
 *
 * This check runs server-side in submitApplication() and purchaseTicket().
 *
 * Note: Telegram verification is encouraged (shown as a warning on /profile)
 * but is NOT required for event enrollment.
 */

export interface ProfileCompletenessResult {
  complete: boolean
  missing: string[]
}

export function checkProfileCompleteness(user: {
  first_name?: string | null
  last_name?: string | null
  emergency_contact?: string | null
  emergency_phone?: string | null
}): ProfileCompletenessResult {
  const missing: string[] = []

  if (!user.first_name?.trim()) missing.push('First name')
  if (!user.last_name?.trim()) missing.push('Last name')
  if (!user.emergency_contact?.trim()) missing.push('Emergency contact name')
  if (!user.emergency_phone?.trim()) missing.push('Emergency contact phone')

  return { complete: missing.length === 0, missing }
}
