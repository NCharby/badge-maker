import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({
        error: 'Missing environment variables',
        supabaseUrl: !!supabaseUrl,
        serviceRoleKey: !!serviceRoleKey
      }, { status: 500 })
    }

    // Test Supabase connection
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    
    // Test basic connection by listing buckets
    const { data: buckets, error } = await supabase.storage.listBuckets()
    
    if (error) {
      return NextResponse.json({
        error: 'Supabase connection failed',
        details: error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Supabase connection successful',
      buckets: buckets?.map(b => b.name) || [],
      hasBadgeImagesBucket: buckets?.some(b => b.name === 'badge-images') || false
    })

  } catch (error) {
    console.error('Test API error:', error)
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
