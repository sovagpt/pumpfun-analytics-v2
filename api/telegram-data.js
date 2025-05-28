export default async function handler(req, res) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;

  if (!TELEGRAM_BOT_TOKEN) {
    return res.status(500).json({ error: "Bot token not configured" });
  }

  if (!TELEGRAM_CHANNEL_ID) {
    return res.status(500).json({ error: "Channel ID not configured" });
  }

  try {
    // Get recent messages from Telegram
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?limit=10`
    );

    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.status}`);
    }

    const data = await response.json();
    
    // For now, just return what we got
    return res.status(200).json({
      status: "success",
      botToken: TELEGRAM_BOT_TOKEN ? "✅ Set" : "❌ Missing",
      channelId: TELEGRAM_CHANNEL_ID,
      messageCount: data.result ? data.result.length : 0,
      lastUpdate: new Date().toISOString()
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message,
      status: "failed"
    });
  }
}
