export default async function handler(req, res) {
  try {
    // Try multiple RSS feed services for Telegram channels
    const rssSources = [
      'https://rsshub.app/telegram/channel/pumpfunvolumereports',
      'https://tg.i-c-a.su/rss/pumpfunvolumereports',
      'https://rss.app/feeds/telegram/pumpfunvolumereports'
    ];

    let rssData = null;
    let successfulSource = null;

    for (const rssUrl of rssSources) {
      try {
        const response = await fetch(rssUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; PumpfunAnalytics/1.0)'
          }
        });

        if (response.ok) {
          const rssText = await response.text();
          if (rssText.includes('Volume Report') || rssText.includes('SOL')) {
            rssData = rssText;
            successfulSource = rssUrl;
            break;
          }
        }
      } catch (e) {
        console.log(`RSS source ${rssUrl} failed:`, e.message);
      }
    }

    if (rssData) {
      // Parse RSS XML to extract latest volume reports
      const volumeReports = extractVolumeReportsFromRSS(rssData);
      
      if (volumeReports.length > 0) {
        const latestReport = volumeReports[0];
        const parsedData = parseVolumeReport(latestReport.content);
        
        return res.status(200).json({
          status: "success",
          dataSource: "live_rss_feed",
          rssSource: successfulSource,
          reportsFound: volumeReports.length,
          latestReport: {
            title: latestReport.title,
            pubDate: latestReport.pubDate,
            content: latestReport.content
          },
          volumeData: parsedData ? {
            current: parsedData,
            timestamp: new Date().toISOString(),
            isLive: true
          } : null,
          lastUpdate: new Date().toISOString()
        });
      }
    }

    // Fallback to sample data if RSS fails
    return res.status(200).json({
      status: "fallback",
      dataSource: "sample_data",
      message: "RSS feeds unavailable, using sample data",
      volumeData: getSampleVolumeData(),
      lastUpdate: new Date().toISOString()
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message,
      status: "failed",
      fallbackData: getSampleVolumeData()
    });
  }
}

function extractVolumeReportsFromRSS(rssXml) {
  const reports = [];
  
  try {
    // Basic XML parsing for RSS items
    const itemRegex = /<item[^>]*>(.*?)<\/item>/gs;
    const items = [...rssXml.matchAll(itemRegex)];
    
    for (const item of items) {
      const itemContent = item[1];
      
      // Extract title
      const titleMatch = itemContent.match(/<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>/);
      const title = titleMatch ? titleMatch[1] : '';
      
      // Extract description/content
      const descMatch = itemContent.match(/<description[^>]*><!\[CDATA\[(.*?)\]\]><\/description>/);
      const content = descMatch ? descMatch[1] : '';
      
      // Extract publication date
      const dateMatch = itemContent.match(/<pubDate>(.*?)<\/pubDate>/);
      const pubDate = dateMatch ? dateMatch[1] : '';
      
      // Only include volume reports
      if (title.toLowerCase().includes('volume report') || 
          content.toLowerCase().includes('total volume')) {
        reports.push({
          title: title,
          content: content,
          pubDate: pubDate
        });
      }
    }
  } catch (e) {
    console.error('RSS parsing error:', e);
  }
  
  return reports;
}

function parseVolumeReport(text) {
  try {
    const data = {};
    
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

    for (const [key, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match) {
        const value = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(value)) {
          data[key] = value;
        }
      }
    }

    return Object.keys(data).length > 3 ? data : null;
  } catch (error) {
    return null;
  }
}

function getSampleVolumeData() {
  // Return sample data with slight variations to simulate updates
  const baseTime = Date.now();
  const variation = Math.sin(baseTime / 100000) * 0.05; // 5% variation
  
  return {
    current: {
      totalTrades: Math.floor(34450 * (1 + variation)),
      newCoins: Math.floor(1257 * (1 + variation * 0.5)),
      totalVolume: parseFloat((14629.24 * (1 + variation)).toFixed(2)),
      buyVolume: parseFloat((8081.8 * (1 + variation)).toFixed(2)),
      sellVolume: parseFloat((6547.44 * (1 + variation)).toFixed(2)),
      totalBuys: Math.floor(17536 * (1 + variation)),
      totalSells: Math.floor(16914 * (1 + variation)),
      reachedKOTH: Math.floor(44 * (1 + variation * 2)),
      fullyBonded: Math.floor(19 * (1 + variation * 1.5)),
      timestamp: new Date().toISOString(),
      isLive: false
    },
    changes: {
      totalTrades: "+5.89%",
      newCoins: "-7.51%",
      totalVolume: "+13.00%",
      buyVolume: "+12.86%",
      sellVolume: "+13.17%",
      totalBuys: "+4.73%",
      totalSells: "+7.13%",
      reachedKOTH: "+62.96%",
      fullyBonded: "+137.50%"
    }
  };
}
