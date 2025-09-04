import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventSlug = searchParams.get('eventSlug') || 'cog-classic-2026';
    
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json({
        success: false,
        error: 'TELEGRAM_BOT_TOKEN not configured'
      }, { status: 500 });
    }

    // Get the group ID from database
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({
        success: false,
        error: 'Supabase configuration missing'
      }, { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('telegram_config')
      .eq('slug', eventSlug)
      .eq('is_active', true)
      .single();

    if (eventError || !eventData?.telegram_config?.privateGroupId) {
      return NextResponse.json({
        success: false,
        error: 'Event or Telegram config not found',
        details: eventError?.message
      }, { status: 404 });
    }

    const groupId = eventData.telegram_config.privateGroupId;

    // Test 1: Get bot info
    const botInfoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const botInfo = await botInfoResponse.json();

    // Test 2: Get chat info
    const chatInfoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getChat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: groupId
      })
    });
    const chatInfo = await chatInfoResponse.json();

    // Test 3: Get chat administrators
    const adminsResponse = await fetch(`https://api.telegram.org/bot${botToken}/getChatAdministrators`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: groupId
      })
    });
    const adminsInfo = await adminsResponse.json();

    // Test 4: Try to create a simple invite link
    const inviteResponse = await fetch(`https://api.telegram.org/bot${botToken}/createChatInviteLink`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: groupId,
        name: 'test-invite',
        expire_date: Math.floor(Date.now() / 1000) + 3600, // 1 hour
        member_limit: 1
      })
    });
    const inviteResult = await inviteResponse.json();

    return NextResponse.json({
      success: true,
      eventSlug,
      groupId,
      tests: {
        botInfo: {
          success: botInfo.ok,
          data: botInfo.result,
          error: botInfo.description
        },
        chatInfo: {
          success: chatInfo.ok,
          data: chatInfo.result,
          error: chatInfo.description
        },
        admins: {
          success: adminsInfo.ok,
          data: adminsInfo.result,
          error: adminsInfo.description
        },
        inviteTest: {
          success: inviteResult.ok,
          data: inviteResult.result,
          error: inviteResult.description
        }
      }
    });

  } catch (error) {
    console.error('Bot permissions test error:', error);
    return NextResponse.json({
      success: false,
      error: 'Test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
