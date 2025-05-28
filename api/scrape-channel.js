export default async function handler(req, res) {
  try {
    // Method 1: Try to scrape the public channel page
    const channelUrl = 'https://t.me/s/pumpfunvolumereports';
    
    const response = await fetch(channelUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch channel: ${response.status}`);
    }

    const html = await response.text();
    
    // Look for volume report messages in the HTML
    const messages = extractMessagesFromHTML(html);
    const volumeReports = messages.filter(msg => 
      msg.toLowerCase().includes('pump volume report') || 
      msg.toLowerCase().includes('total volume')
    );

    let latestVolumeData = null;
    if (volumeReports.length > 0) {
      latestVolumeData = parseVolumeReport(volumeReports[0]);
    }

    return res.status(200).json({
      status: "success",
      method: "web-scraping",
      channelUrl: channelUrl,
      messagesFound: messages.length,
      volumeReportsFound: volumeReports.length,
      latestReport: volumeReports[0] || null,
      parsedData: latestVolumeData,
      lastUpdate: new Date().toISOString()
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message,
      status: "failed",
      method: "web-scraping"
    });
  }
}

function extractMessagesFromHTML(html) {
  const messages = [];
  
  // Look for message content in Telegram's public page structure
  const messagePatterns = [
    /<div class="tgme_widget_message_text.*?"[^>]*>(.*?)<\/div>/gs,
    /<div class="js-message_text.*?"[^>]*>(.*?)<\/div>/gs,
    /class="tgme_widget_message_text"[^>]*>(.*?)<\/div>/gs
  ];

  for (const pattern of messagePatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      let text = match[1];
      // Clean HTML tags
      text = text.replace(/<[^>]*>/g, '').trim();
      if (text && text.length > 10) {
        messages.push(text);
      }
    }
  }

  // Fallback: look for any text containing "SOL" and numbers
  if (messages.length === 0) {
    const fallbackPattern = /[^<>]*\d+[,.]?\d*\s*SOL[^<>]*/g;
    const fallbackMatches = html.match(fallbackPattern);
    if (fallbackMatches) {
      messages.push(...fallbackMatches);
    }
  }

  return messages;
}

function parseVolumeReport(text) {
  try {
    const data = {};
    
    const patterns = {
      totalVolume: /Total Volume[:\s]+([\d,]+\.?\d*)\s*SOL/i,
      buyVolume: /Buy Volume[:\s]+([\d,]+\.?\d*)\s*SOL/i,
      sellVolume: /Sell Volume[:\s]+([\d,]+\.?\d*)\s*SOL/i,
      totalTrades: /Total Trades[:\s]+([\d,]+)/i,
      newCoins: /New Coins[:\s]+([\d,]+)/i,
      totalBuys: /Total Buys[:\s]+([\d,]+)/i,
      totalSells: /Total Sells[:\s]+([\d,]+)/i,
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
