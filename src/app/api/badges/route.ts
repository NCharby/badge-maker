import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    // Check environment variables first
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing environment variables')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Create Supabase client inside the function
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const body = await request.json()
    const { 
      badge_name, 
      email, 
      social_media_handles, 
      original_image_url, 
      cropped_image_url, 
      crop_data,
      waiver_id,
      event_slug 
    } = body

    // Validate required fields
    if (!badge_name || !email) {
      return NextResponse.json(
        { error: 'Badge name and email are required' },
        { status: 400 }
      )
    }

    // Validate badge name length
    if (badge_name && badge_name.length > 40) {
      return NextResponse.json(
        { error: 'Badge name must be 40 characters or less' },
        { status: 400 }
      )
    }

    // Validate social media handles limit
    if (social_media_handles && social_media_handles.length > 2) {
      return NextResponse.json(
        { error: 'Maximum 2 social media handles allowed' },
        { status: 400 }
      )
    }

    // Check if waiver exists and is completed
    let sessionId = null;
    if (waiver_id) {
      const { data: waiver, error: waiverError } = await supabase
        .from('waivers')
        .select('session_id')
        .eq('id', waiver_id)
        .single();

      if (waiverError || !waiver) {
        return NextResponse.json(
          { error: 'Invalid or missing waiver' },
          { status: 400 }
        )
      }
      sessionId = waiver.session_id;
    }

    // Create a new session if no waiver session exists
    if (!sessionId) {
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          session_data: { badge_name, email, social_media_handles }
        })
        .select()
        .single()

      if (sessionError) {
        console.error('Session creation error:', sessionError)
        return NextResponse.json(
          { error: 'Failed to create session' },
          { status: 500 }
        )
      }
      sessionId = session.id;
    }

    // Create the badge
    const { data: badge, error: badgeError } = await supabase
      .from('badges')
      .insert({
        session_id: sessionId,
        waiver_id: waiver_id || null,
        badge_name,
        email,
        original_image_url,
        cropped_image_url,
        crop_data,
        social_media_handles,
        badge_data: {
          badge_name,
          email,
          social_media_handles,
          original_image_url,
          cropped_image_url,
          crop_data
        },
        status: 'published'
      })
      .select()
      .single()

    if (badgeError) {
      console.error('Badge creation error:', badgeError)
      return NextResponse.json(
        { error: 'Failed to create badge' },
        { status: 500 }
      )
    }

    // Generate telegram invite if available
    try {
      const { createTelegramService } = await import('@/lib/telegram/telegram-service');
      const telegramService = createTelegramService();
      
      // Check if telegram is available for this event
      const isAvailable = await telegramService.isAvailable(event_slug);
      if (isAvailable) {
        const invite = await telegramService.generatePrivateInvite(event_slug, sessionId);
        if (invite) {
        } else {
        }
      } else {
      }
    } catch (telegramError) {
      // Don't fail badge creation if telegram fails
      console.error('Telegram invite generation failed:', telegramError);
    }

    return NextResponse.json({
      success: true,
      badge_id: badge.id,
      session_id: sessionId,
      badge: {
        id: badge.id,
        badge_name: badge.badge_name,
        email: badge.email,
        status: badge.status,
        created_at: badge.created_at
      }
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check environment variables first
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing environment variables')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Create Supabase client inside the function
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { searchParams } = new URL(request.url)
    const badgeId = searchParams.get('id')
    const sessionId = searchParams.get('session_id')

    if (!badgeId && !sessionId) {
      return NextResponse.json(
        { error: 'Badge ID or session ID is required' },
        { status: 400 }
      )
    }

    let query = supabase
      .from('badges')
      .select('*')

    if (badgeId) {
      query = query.eq('id', badgeId)
    } else if (sessionId) {
      query = query.eq('session_id', sessionId)
    }

    const { data: badges, error } = await query

    if (error) {
      console.error('Badge retrieval error:', error)
      return NextResponse.json(
        { error: 'Failed to retrieve badge' },
        { status: 500 }
      )
    }

    if (!badges || badges.length === 0) {
      return NextResponse.json(
        { error: 'Badge not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      badge: badges[0]
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
