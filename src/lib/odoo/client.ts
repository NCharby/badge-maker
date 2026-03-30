// TODO: Odoo integration — not implemented
// Requires: ODOO_API_URL, ODOO_API_KEY (or OAuth credentials)
// Set these in .env.local and production hPanel env when credentials are available

export interface OdooWaiverStatus {
  signed: boolean
  signedAt?: string
  waiverVersion?: string
}

export async function getWaiverStatus(
  userId: string,
  eventId: string
): Promise<OdooWaiverStatus | null> {
  // TODO: Odoo integration — not implemented
  console.warn('[odoo] getWaiverStatus called but Odoo is not configured')
  return null
}

export async function sendWaiverRequest(
  userId: string,
  eventId: string,
  userEmail: string
): Promise<{ success: boolean; error?: string }> {
  // TODO: Odoo integration — not implemented
  console.warn('[odoo] sendWaiverRequest called but Odoo is not configured')
  return { success: false, error: 'Odoo integration not yet configured' }
}
