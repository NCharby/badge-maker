import { NextRequest } from 'next/server'
import { Bot, webhookCallback } from 'grammy'

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN is not set')
}

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN)

bot.command('start', async (ctx) => {
  await ctx.reply(
    'Welcome to the SD Platform bot! 🐕\n\n' +
      'You can use this bot to receive event notifications.\n\n' +
      'If you need help with your registration or have a question, send a message and our team will follow up via email.'
  )
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
