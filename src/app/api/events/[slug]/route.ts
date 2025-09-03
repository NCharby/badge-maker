import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    
    if (!slug) {
      return NextResponse.json(
        { error: 'Event slug is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch event data
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found or inactive' },
        { status: 404 }
      );
    }

    // Fetch template data
    const { data: template, error: templateError } = await supabase
      .from('templates')
      .select('*')
      .eq('id', event.template_id)
      .single();

    if (templateError) {
      return NextResponse.json(
        { error: 'Failed to load template' },
        { status: 500 }
      );
    }

    const eventData = {
      event: {
        id: event.id,
        slug: event.slug,
        name: event.name,
        description: event.description,
        startDate: event.start_date,
        endDate: event.end_date,
        isActive: event.is_active,
        createdAt: event.created_at,
        updatedAt: event.updated_at,
      },
      template: template?.config || null,
    };

    return NextResponse.json(eventData);
  } catch (error) {
    console.error('Error fetching event data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
