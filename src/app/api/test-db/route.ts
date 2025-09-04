import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    // Test database connection
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({
        success: false,
        error: 'Supabase configuration missing'
      }, { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Test basic connection
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .limit(5);

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Database connection failed',
        details: error.message
      }, { status: 500 });
    }

    // Check for default event specifically
    const { data: defaultEvent } = await supabase
      .from('events')
      .select('*')
      .eq('slug', 'default')
      .eq('is_active', true)
      .single();

    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      totalEvents: events?.length || 0,
      defaultEvent: defaultEvent ? {
        id: defaultEvent.id,
        slug: defaultEvent.slug,
        name: defaultEvent.name,
        is_active: defaultEvent.is_active
      } : null,
      allEvents: events?.map(e => ({ id: e.id, slug: e.slug, name: e.name, is_active: e.is_active }))
    });

  } catch (error) {
    console.error('Database test failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Database test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
