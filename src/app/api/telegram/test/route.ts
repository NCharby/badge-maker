import { NextRequest, NextResponse } from 'next/server';
import { createTelegramService } from '@/lib/telegram/telegram-service';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventSlug = searchParams.get('eventSlug') || 'cog-classic-2026';

    console.log('Testing Telegram integration for event:', eventSlug);

    // Test 1: Check environment variables
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const hasBotToken = !!botToken;
    const tokenPreview = botToken ? `${botToken.substring(0, 10)}...` : 'NOT SET';

    // Test 2: Check database configuration
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('slug', eventSlug)
      .eq('is_active', true)
      .single();

    // Test 3: Check Telegram service availability
    const telegramService = createTelegramService();
    const isAvailable = await telegramService.isAvailable(eventSlug);

    // Test 4: Test bot connection
    const botConnectionTest = await telegramService.testBotConnection(eventSlug);

    // Test 5: Get Telegram config details
    const telegramConfig = eventData?.telegram_config;

    const testResults = {
      eventSlug,
      timestamp: new Date().toISOString(),
      tests: {
        environment: {
          hasBotToken,
          tokenPreview,
          status: hasBotToken ? 'PASS' : 'FAIL'
        },
        database: {
          eventExists: !!eventData,
          eventError: eventError?.message || null,
          telegramConfig,
          status: eventData ? 'PASS' : 'FAIL'
        },
        telegramService: {
          isAvailable,
          botConnectionTest,
          status: isAvailable && botConnectionTest ? 'PASS' : 'FAIL'
        }
      },
      summary: {
        overallStatus: hasBotToken && eventData && isAvailable && botConnectionTest ? 'PASS' : 'FAIL',
        issues: []
      }
    };

    // Identify issues
    if (!hasBotToken) {
      testResults.summary.issues.push('TELEGRAM_BOT_TOKEN environment variable not set');
    }
    if (!eventData) {
      testResults.summary.issues.push(`Event '${eventSlug}' not found in database`);
    }
    if (!telegramConfig?.enabled) {
      testResults.summary.issues.push('Telegram integration not enabled for this event');
    }
    if (!telegramConfig?.privateGroupId) {
      testResults.summary.issues.push('Private group ID not configured');
    }
    if (!isAvailable) {
      testResults.summary.issues.push('Telegram service not available');
    }
    if (!botConnectionTest) {
      testResults.summary.issues.push('Bot connection test failed');
    }

    return NextResponse.json(testResults, { 
      status: testResults.summary.overallStatus === 'PASS' ? 200 : 400 
    });

  } catch (error) {
    console.error('Telegram test error:', error);
    return NextResponse.json({
      error: 'Test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
