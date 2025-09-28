import { NextRequest, NextResponse } from 'next/server';
import { createTelegramService } from '@/lib/telegram/telegram-service';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const eventSlug = searchParams.get('eventSlug');

    if (!eventSlug) {
      return NextResponse.json({
        success: false,
        error: 'Event slug is required'
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

    // Check if event has per-event invite configured
    const hasEventInvite = await telegramService.hasEventInvite(eventSlug);
    if (!hasEventInvite) {
      return NextResponse.json({
        success: false,
        error: 'No per-event invite link configured for this event'
      }, { status: 404 });
    }

    // Get the per-event invite link
    const eventInvite = await telegramService.getEventInviteLink(eventSlug);
    
    if (!eventInvite) {
      return NextResponse.json({
        success: false,
        error: 'Failed to retrieve event invite link'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      invite: eventInvite,
      source: 'event' // Indicates this is a per-event invite
    });

  } catch (error) {
    console.error('Error in event-invite endpoint:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
