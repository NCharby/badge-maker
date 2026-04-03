/**
 * Waiver provider interface.
 *
 * The platform supports multiple waiver backends:
 * - LegacyPuppeteerProvider: generates a PDF via Puppeteer and stores it in
 *   the badge-maker waivers table (current implementation)
 * - OdooProvider (future): delegates waiver signing to Odoo
 *
 * All providers accept the same WaiverSubmission and return a WaiverResult.
 */

export interface WaiverSubmission {
  firstName: string
  lastName: string
  email: string
  dateOfBirth: string // ISO date string (YYYY-MM-DD)

  emergencyContact: string
  emergencyPhone: string

  signatureImage: string // base64 data URL from SignatureCapture

  eventSlug: string
  userId: string
  eventId: string

  waiverContent?: string // EP-configured waiver template text; used in PDF generation
}

export interface WaiverResult {
  success: boolean
  waiverId?: string
  pdfUrl?: string
  error?: string
}

export interface WaiverProvider {
  submitWaiver(data: WaiverSubmission): Promise<WaiverResult>
}
