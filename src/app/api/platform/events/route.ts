import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/platform/events
// Returns published+ events. No PII. Auth required.
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminSupabase = await createAdminClient()

  const { data: events, error } = await adminSupabase
    .from('platform_events')
    .select('id, title, description, start_date, end_date, location, status, module_config')
    .not('status', 'in', '("Draft")')
    .order('start_date', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(events ?? [])
}
