export default async function handler(req, res) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

  if (!TELEGRAM_BOT_TOKEN) {
    return res.status(500).json({ error: "Bot token not configured" });
  }

  try {
    // Get recent messages sent TO your bot (including forwards)
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?limit=20&offset=-20`
    );

    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.status}`);
    }

    const data = await response.json();
    
    let latestVolumeData = null;
    let latestMessage = null;
    let messageCount = data.result ? data.result.length : 0;

    // Look through messages sent to your bot
    if (data.result && data.result.length > 0) {
      for (const update of data.result.reverse()) { // Start with most recent
        const message = update.message;
        if (message && message.text) {
          const text = message.text;
          
          // Check if this looks like a volume report
          if (text.includes('Pump Volume Report') || 
              (text.includes('Total Volume') && text.includes('SOL'))) {
            
            latestMessage = text;
            latestVolumeData = parseVolumeReport(text);
            break; // Use the most recent volume report
          }
        }
      }
    }

    return res.status(200).json({
      status: "success",
      dataSource: latestVolumeData ? "forwarded_telegram_message" : "no_data",
      botToken: "✅ Set",
      messageCount: messageCount,
      latestVolumeReport: latestMessage ? "Found volume report!" : "No volume reports found",
      volumeData: latestVolumeData ? {
        current: latestVolumeData,
        timestamp: new Date().toISOString(),
        isLive: true,
        source: "telegram_forward"
      } : null,
      instructions: latestVolumeData ? null : {
        step1: "Go to https://t.me/pumpfun_analytics_bot",
        step2: "Start a conversation with your bot",
        step3: "Forward a volume report from @pumpfunvolumereports",
        step4: "Refresh your dashboard to see live data!"
      },
      lastUpdate: new Date().toISOString()
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
    
    // Enhanced parsing for your exact format
    const patterns = {
      totalTrades: /Total Trades[:\s]+([\d,]+)/i,
      newCoins: /New Coins[:\s]+([\d,]+)/i,
      totalVolume: /Total Volume[:\s]+([\d,]+\.?\d*)\s*SOL/i,
      buyVolume: /Buy Volume[:\s]+([\d,]+\.?\d*)\s*SOL/i,
      sellVolume: /Sell Volume[:\s]+([\d,]+\.?\d*)\s*SOL/i,
      totalBuys: /Total Buys[:\s]+([\d,]+)/i,
      totalSells: /Total Sells[:\s]+([\d,]+)/i,
      reachedKOTH: /Reached KOTH[:\s]+([\d,]+)/i,
      fullyBonded: /Fully Bonded[:\s]+([\d,]+)/i
    };

    // Extract percentage changes too
    const changePatterns = {
      tradesChange: /Total Trades[:\s]+[\d,]+\s*\(([+-]?[\d.]+%)\)/i,
      coinsChange: /New Coins[:\s]+[\d,]+\s*\(([+-]?[\d.]+%)\)/i,
      volumeChange: /Total Volume[:\s]+[\d,]+\.?\d*\s*SOL\s*\(([+-]?[\d.]+%)\)/i,
      buyChange: /Buy Volume[:\s]+[\d,]+\.?\d*\s*SOL\s*\(([+-]?[\d.]+%)\)/i,
      sellChange: /Sell Volume[:\s]+[\d,]+\.?\d*\s*SOL\s*\(([+-]?[\d.]+%)\)/i,
      kothChange: /Reached KOTH[:\s]+[\d,]+\s*\(([+-]?[\d.]+%)\)/i,
      bondedChange: /Fully Bonded[:\s]+[\d,]+\s*\(([+-]?[\d.]+%)\)/i
    };

    // Parse main values
    for (const [key, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match) {
        const value = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(value)) {
          data[key] = value;
        }
      }
    }

    // Parse percentage changes
    const changes = {};
    for (const [key, pattern] of Object.entries(changePatterns)) {
      const match = text.match(pattern);
      if (match) {
        changes[key] = match[1];
      }
    }

    // Add changes to the data
    if (Object.keys(changes).length > 0) {
      data.changes = changes;
    }

    return Object.keys(data).length > 3 ? data : null;
  } catch (error) {
    console.error('Parse error:', error);
    return null;
  }
}
