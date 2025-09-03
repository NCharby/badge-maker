import { NextResponse } from 'next/server';
import { createTelegramService } from '@/lib/telegram/telegram-service';

export async function GET() {
  try {
    const telegramService = createTelegramService();
    
    if (!telegramService.isAvailable()) {
      return NextResponse.json({
        success: false,
        error: 'Telegram integration not configured',
        details: 'TELEGRAM_BOT_TOKEN environment variable is not set'
      }, { status: 503 });
    }

    const connectionTest = await telegramService.testBotConnection();
    
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
