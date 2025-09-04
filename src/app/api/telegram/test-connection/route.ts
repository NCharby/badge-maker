import { NextResponse } from 'next/server';
import { createTelegramService } from '@/lib/telegram/telegram-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventSlug = searchParams.get('eventSlug') || 'default';
    
    
    const telegramService = createTelegramService();
    
    const isAvailable = await telegramService.isAvailable(eventSlug);
    
    if (!isAvailable) {
      return NextResponse.json({
        success: false,
        error: 'Telegram integration not configured',
        details: `Telegram not configured for event: ${eventSlug}`
      }, { status: 503 });
    }

    const connectionTest = await telegramService.testBotConnection(eventSlug);
    
    if (connectionTest) {
      return NextResponse.json({
        success: true,
        message: 'Telegram bot connection successful',
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Telegram bot connection failed',
        details: 'Bot token may be invalid or bot may not be accessible'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error testing Telegram connection:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
