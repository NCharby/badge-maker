/**
 * Waiver provider factory.
 *
 * Returns the appropriate WaiverProvider based on environment configuration.
 * Currently only the legacy Puppeteer-based provider is available.  When Odoo
 * API credentials are provided the factory will return an OdooProvider instead.
 */

import { LegacyPuppeteerProvider } from './legacy-provider'
import type { WaiverProvider } from './waiver-provider'

export type { WaiverProvider, WaiverSubmission, WaiverResult } from './waiver-provider'

export function getWaiverProvider(): WaiverProvider {
  // TODO: Odoo integration — not implemented
  // When Odoo credentials are available:
  // if (process.env.ODOO_API_URL && process.env.ODOO_API_KEY) {
  //   return new OdooProvider()
  // }
  return new LegacyPuppeteerProvider()
}
