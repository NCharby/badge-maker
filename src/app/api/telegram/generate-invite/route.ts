import { NextRequest, NextResponse } from 'next/server';
import { createTelegramService } from '@/lib/telegram/telegram-service';
import { GenerateInviteRequest, GenerateInviteResponse } from '@/types/telegram';

export async function POST(request: NextRequest): Promise<NextResponse<GenerateInviteResponse>> {
  try {
    const body: GenerateInviteRequest = await request.json();
    const { eventSlug, sessionId } = body;

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
    const isAvailable = await telegramService.isAvailable(eventSlug);
    if (!isAvailable) {
      return NextResponse.json({
        success: false,
        error: 'Telegram integration not configured for this event'
      }, { status: 503 });
    }

    const invite = await telegramService.generatePrivateInvite(eventSlug, sessionId);
    
    if (!invite) {
      console.error('Failed to generate invite - service returned null');
      return NextResponse.json({
        success: false,
        error: 'Failed to generate invite link'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      invite
    });

  } catch (error) {
    console.error('Error in generate-invite endpoint:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
