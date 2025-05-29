// api/ai-analysis.js
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'AI service not configured' });
  }

  try {
    const { query, currentData, previousData, hourlyData } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Build context from volume data
    const dataContext = buildDataContext(currentData, previousData, hourlyData);
    
    // Call Anthropic API
    const aiResponse = await callAnthropicAPI(query, dataContext, ANTHROPIC_API_KEY);
    
    res.status(200).json({ response: aiResponse });
  } catch (error) {
    console.error('AI Analysis error:', error);
    res.status(500).json({ error: 'AI analysis failed' });
  }
}

function buildDataContext(currentData, previousData, hourlyData) {
  let context = "pump.fun volume analytics data:\n\n";

  // Current data
  if (currentData && currentData.totalVolume) {
    context += "CURRENT PERIOD:\n";
    context += `• total volume: ${currentData.totalVolume.toFixed(2)} sol\n`;
    context += `• buy volume: ${currentData.buyVolume?.toFixed(2) || 'n/a'} sol\n`;
    context += `• sell volume: ${currentData.sellVolume?.toFixed(2) || 'n/a'} sol\n`;
    context += `• total trades: ${currentData.totalTrades?.toLocaleString() || 'n/a'}\n`;
    context += `• new coins: ${currentData.newCoins?.toLocaleString() || 'n/a'}\n`;
    context += `• total buys: ${currentData.totalBuys?.toLocaleString() || 'n/a'}\n`;
    context += `• total sells: ${currentData.totalSells?.toLocaleString() || 'n/a'}\n`;
    context += `• reached koth: ${currentData.reachedKOTH || 'n/a'}\n`;
    context += `• fully bonded: ${currentData.fullyBonded || 'n/a'}\n`;
    
    if (currentData.changes) {
      context += "\nCHANGES FROM PREVIOUS PERIOD:\n";
      context += `• volume change: ${currentData.changes.volumeChange || 'n/a'}\n`;
      context += `• trades change: ${currentData.changes.tradesChange || 'n/a'}\n`;
      context += `• new coins change: ${currentData.changes.coinsChange || 'n/a'}\n`;
      context += `• koth change: ${currentData.changes.kothChange || 'n/a'}\n`;
    }
    
    if (currentData.timestamp) {
      context += `• last updated: ${new Date(currentData.timestamp).toLocaleString()}\n`;
    }
    context += "\n";
  }

  // Market analysis context
  context += "ANALYSIS CONTEXT:\n";
  context += "• pump.fun is a solana-based token launch platform\n";
  context += "• koth = king of the hill (successful token launches)\n";
  context += "• fully bonded = tokens that reached full liquidity bonding\n";
  context += "• higher buy/sell ratios indicate bullish sentiment\n";
  context += "• volume trends indicate market activity and interest\n\n";

  return context;
}

async function callAnthropicAPI(query, dataContext, apiKey) {
  const prompt = `${dataContext}

USER QUERY: ${query}

please provide a helpful analysis based on the pump.fun volume data above. be specific with numbers when relevant, identify trends, and give actionable insights. keep responses concise but informative. use lowercase text to match the pump.fun style.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 800,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Anthropic API error:', response.status, errorData);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0].text;
  } catch (error) {
    console.error('Error calling Anthropic API:', error);
    throw error;
  }
}
