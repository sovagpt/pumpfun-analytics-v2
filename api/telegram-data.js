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
    // Method 1: Try to get updates (for channels the bot is in)
    const updatesResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?limit=10`
    );

    let messageCount = 0;
    let latestMessage = null;

    if (updatesResponse.ok) {
      const updatesData = await updatesResponse.json();
      messageCount = updatesData.result ? updatesData.result.length : 0;
      
      // Look for volume reports
      if (updatesData.result && updatesData.result.length > 0) {
        for (const update of updatesData.result) {
          if (update.message && update.message.text) {
            const text = update.message.text.toLowerCase();
            if (text.includes('pump volume report') || text.includes('total volume')) {
              latestMessage = update.message.text;
              break;
            }
          }
        }
      }
    }

    // Method 2: Try to get channel info (for public channels)
    let channelInfo = null;
    try {
      const chatResponse = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChat?chat_id=${TELEGRAM_CHANNEL_ID}`
      );
      if (chatResponse.ok) {
        const chatData = await chatResponse.json();
        channelInfo = chatData.result;
      }
    } catch (e) {
      // Channel info might not be accessible
    }

    // If we have a volume report message, parse it
    let volumeData = null;
    if (latestMessage) {
      volumeData = parseVolumeReport(latestMessage);
    }

    return res.status(200).json({
      status: "success",
      botToken: "✅ Set",
      channelId: TELEGRAM_CHANNEL_ID,
      messageCount: messageCount,
      channelInfo: channelInfo ? {
        title: channelInfo.title,
        type: channelInfo.type,
        memberCount: channelInfo.members_count
      } : "Not accessible",
      latestVolumeReport: latestMessage ? "Found!" : "No recent reports",
      volumeData: volumeData,
      lastUpdate: new Date().toISOString(),
      debug: {
        botCanReadChannel: messageCount > 0,
        suggestion: messageCount === 0 ? "Bot may need to join the channel or channel may be private" : "Bot is receiving messages"
      }
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message,
      status: "failed"
    });
  }
}

function parseVolumeReport(text) {
  try {
    const data = {};
    
    // Parse patterns from your volume reports
    const patterns = {
      totalVolume: /Total Volume[:\s]+([\d,]+\.?\d*)\s*SOL/i,
      buyVolume: /Buy Volume[:\s]+([\d,]+\.?\d*)\s*SOL/i,
      sellVolume: /Sell Volume[:\s]+([\d,]+\.?\d*)\s*SOL/i,
      totalTrades: /Total Trades[:\s]+([\d,]+)/i,
      newCoins: /New Coins[:\s]+([\d,]+)/i,
      reachedKOTH: /Reached KOTH[:\s]+([\d,]+)/i,
      fullyBonded: /Fully Bonded[:\s]+([\d,]+)/i
    };

    for (const [key, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match) {
        const value = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(value)) {
          data[key] = value;
        }
      }
    }

    return Object.keys(data).length > 0 ? data : null;
  } catch (error) {
    return null;
  }
}
