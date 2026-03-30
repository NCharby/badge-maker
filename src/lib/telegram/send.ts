export async function sendTelegramMessage(
  telegramHandle: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken || !telegramHandle) {
    return { success: false, error: 'Bot token or handle missing' }
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: `@${telegramHandle}`,
        text: message,
        parse_mode: 'HTML',
      }),
    })
    const data = await res.json()
    if (!data.ok) return { success: false, error: data.description }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
