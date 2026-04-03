/**
 * Legacy waiver provider — generates a PDF via Puppeteer and writes records
 * into the badge-maker `sessions` and `waivers` tables.
 *
 * This replicates the behaviour of the old standalone waiver flow but runs
 * within the authenticated platform context.  When Odoo credentials are
 * available this provider will be replaced by OdooProvider.
 */

import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { generateWaiverPDF } from '@/lib/pdf'
import { getBadgeMakerEventForPlatformEvent } from '@/lib/badge-maker-bridge'
import type { WaiverProvider, WaiverSubmission, WaiverResult } from './waiver-provider'

export class LegacyPuppeteerProvider implements WaiverProvider {
  async submitWaiver(data: WaiverSubmission): Promise<WaiverResult> {
    const admin = createAdminClient()

    // ---- 1. Resolve platform event to badge-maker event (auto-creates if needed) ----
    const bridge = await getBadgeMakerEventForPlatformEvent(data.eventId)
    if (!bridge) {
      return {
        success: false,
        error: 'Could not resolve badge-maker event for this event.',
      }
    }
    const badgeMakerEventId = bridge.badgeMakerEventId

    // ---- 2. Create a badge-maker session ----
    const { data: session, error: sessionError } = await admin
      .from('sessions')
      .insert({
        event_id: badgeMakerEventId,
        session_data: { source: 'platform_waiver', platform_user_id: data.userId },
        waiver_completed: false,
      })
      .select('id')
      .single()

    if (sessionError || !session) {
      return { success: false, error: `Failed to create session: ${sessionError?.message ?? 'unknown'}` }
    }

    // ---- 3. Capture request metadata ----
    let ipAddress: string | undefined
    let userAgent: string | undefined
    try {
      const headerStore = await headers()
      ipAddress =
        headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        headerStore.get('x-real-ip') ||
        undefined
      userAgent = headerStore.get('user-agent') || undefined
    } catch {
      // headers() may throw in certain execution contexts — proceed without
    }

    const signedAt = new Date().toISOString()
    const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ')

    // ---- 4. Fetch EP-configured waiver template (if any) ----
    let waiverContent: string | undefined = data.waiverContent
    if (!waiverContent) {
      const { data: template } = await admin
        .from('waiver_templates')
        .select('content')
        .eq('event_id', data.eventId)
        .single()
      if (template?.content) {
        waiverContent = template.content
      }
    }

    // ---- 5. Generate PDF ----
    const pdfResult = await generateWaiverPDF(
      {
        fullName,
        email: data.email,
        dateOfBirth: data.dateOfBirth,
        emergencyContact: data.emergencyContact,
        emergencyPhone: data.emergencyPhone,
        signatureImage: data.signatureImage,
        waiverVersion: '1.0.0',
        signedAt,
        ipAddress,
        userAgent,
        waiverContent,
      },
      admin,
    )

    if (!pdfResult.success) {
      // Cleanup: remove the orphaned session created in step 2
      await admin.from('sessions').delete().eq('id', session.id)
      return { success: false, error: pdfResult.error ?? 'PDF generation failed.' }
    }

    // ---- 6. Insert waiver record ----
    const { data: waiver, error: waiverError } = await admin
      .from('waivers')
      .insert({
        session_id: session.id,
        event_id: badgeMakerEventId,
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        date_of_birth: data.dateOfBirth,
        emergency_contact: data.emergencyContact,
        emergency_phone: data.emergencyPhone,
        // Legacy fields — the platform does not collect these on the waiver page
        dietary_restrictions: [],
        dietary_restrictions_other: null,
        volunteering_interests: [],
        additional_notes: null,
        // Signature & legal
        signature_data: { dataUrl: data.signatureImage },
        signature_image_url: null,
        waiver_version: '1.0.0',
        signed_at: signedAt,
        ip_address: ipAddress ?? null,
        user_agent: userAgent ?? null,
        pdf_url: pdfResult.pdfUrl ?? null,
        pdf_generated_at: pdfResult.pdfUrl ? new Date().toISOString() : null,
      })
      .select('id')
      .single()

    if (waiverError || !waiver) {
      return { success: false, error: `Failed to save waiver: ${waiverError?.message ?? 'unknown'}` }
    }

    // ---- 7. Update session with waiver reference ----
    await admin
      .from('sessions')
      .update({ waiver_completed: true, waiver_id: waiver.id })
      .eq('id', session.id)

    return {
      success: true,
      waiverId: waiver.id,
      pdfUrl: pdfResult.pdfUrl,
    }
  }
}
