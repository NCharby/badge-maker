import { NextRequest, NextResponse } from 'next/server';
import { createTelegramService } from '@/lib/telegram/telegram-service';
import { GroupInfoResponse } from '@/types/telegram';

export async function GET(request: NextRequest): Promise<NextResponse<GroupInfoResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const eventSlug = searchParams.get('eventSlug');
    const sessionId = searchParams.get('sessionId');

    if (!eventSlug) {
      return NextResponse.json({
        success: false,
        error: 'Event slug is required'
      }, { status: 400 });
    }

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Session ID is required'
      }, { status: 400 });
    }

    const telegramService = createTelegramService();
    
    // Check if Telegram integration is available
    if (!telegramService.isAvailable()) {
      return NextResponse.json({
        success: false,
        error: 'Telegram integration not configured'
      }, { status: 503 });
    }

    const groupInfo = await telegramService.getGroupInfo(eventSlug, sessionId);
    
    if (!groupInfo) {
      return NextResponse.json({
        success: false,
        error: 'No Telegram configuration found for this event'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: groupInfo
    });

  } catch (error) {
    console.error('Error in group-info endpoint:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
