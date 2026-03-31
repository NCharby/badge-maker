import { NextRequest } from 'next/server'
import { Bot, webhookCallback } from 'grammy'
import { createClient } from '@supabase/supabase-js'

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN is not set')
}

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN)

bot.command('start', async (ctx) => {
  await ctx.reply(
    'Welcome to the SD Platform bot! 🐕\n\n' +
      'You can use this bot to receive personal event notifications.\n\n' +
      'To verify your Telegram account:\n' +
      '1. Visit your Profile page on the SD Platform\n' +
      '2. Click "Get verification code"\n' +
      '3. Send <code>/verify YOUR_CODE</code> here\n\n' +
      'If you need help with your registration or have a question, send a message and our team will follow up via email.'
  )
})

bot.command('verify', async (ctx) => {
  const code = ctx.match?.trim()
  if (!code || !/^\d{6}$/.test(code)) {
    await ctx.reply('Please provide a valid 6-digit code. Example: <code>/verify 123456</code>')
    return
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data: user, error } = await admin
    .from('platform_users')
    .select('id, telegram_verification_code, telegram_verification_expires_at')
    .eq('telegram_verification_code', code)
    .gt('telegram_verification_expires_at', now)
    .single()

  if (error || !user) {
    await ctx.reply(
      'This code is invalid or has expired. Request a new one from your Profile page.'
    )
    return
  }

  const chatId = ctx.from?.id
  if (!chatId) {
    await ctx.reply('Could not determine your Telegram user ID. Please try again.')
    return
  }

  const { error: updateError } = await admin
    .from('platform_users')
    .update({
      telegram_chat_id: chatId,
      telegram_verified: true,
      telegram_notifications_enabled: true,
      telegram_verification_code: null,
      telegram_verification_expires_at: null,
    })
    .eq('id', user.id)

  if (updateError) {
    await ctx.reply('Something went wrong. Please try again or contact support.')
    return
  }

  await ctx.reply('✅ Verified! You\'ll now receive notifications here.')
})

// Inbound messages → stub for Odoo Help Desk (Tier 2)
bot.on('message:text', async (ctx) => {
  // TODO: Odoo Help Desk routing — not implemented
  await ctx.reply('Thanks for your message. Our team will follow up via email shortly.')
})

const handler = webhookCallback(bot, 'std/http')

export async function POST(request: NextRequest) {
  return handler(request)
}
