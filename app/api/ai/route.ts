import { NextRequest, NextResponse } from 'next/server';

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, prompt } = body;

    const apiKey = process.env.PERPLEXITY_API_KEY || '';
    if (!apiKey) {
      return NextResponse.json({ error: 'Perplexity API key not configured' }, { status: 500 });
    }

    const systemPrompt = `You are an expert Indian stock market analyst. You analyze NSE and BSE listed stocks for swing trading (2-8 weeks) and long-term investing (1-3 years). Always respond with valid JSON only. No extra text outside JSON.`;

    let userPrompt = '';

    if (type === 'sentiment') {
      userPrompt = `Analyze current Indian stock market sentiment for NIFTY 50, SENSEX, and BANK NIFTY today. Return ONLY this JSON:
{"overall":"Bullish|Bearish|Neutral","confidence":<0-100>,"summary":"<2 sentences>","factors":{"technical":"Bullish|Bearish|Neutral","news":"Bullish|Bearish|Neutral","volume":"Bullish|Bearish|Neutral","fii_dii":"Bullish|Bearish|Neutral"},"nifty_range":{"support":<number>,"resistance":<number>}}`;
    } else if (type === 'recommendations') {
      userPrompt = `Give top 3 Indian NSE stock recommendations for swing trading right now. Return ONLY this JSON array:
[{"symbol":"NSE_SYMBOL","name":"Company Name","action":"BUY|SELL|HOLD|ACCUMULATE","currentPrice":<number>,"targetPrice":<number>,"stopLoss":<number>,"timeframe":"2-4 weeks","confidence":<0-100>,"aiScore":<1-10>,"reasoning":"<2 sentences>","riskFactors":["risk1","risk2"],"catalysts":["catalyst1","catalyst2"]}]`;
    } else if (type === 'patterns') {
      userPrompt = `Identify top 3 technical chart patterns forming in NSE stocks right now. Return ONLY this JSON array:
[{"pattern":"Pattern Name","bias":"Bullish|Bearish","stocks":["SYMBOL1","SYMBOL2"],"description":"<one line>","confidence":<0-100>,"breakoutLevel":<number>,"stopLoss":<number>,"timeframe":"1-3 weeks"}]`;
    } else if (type === 'predictions') {
      userPrompt = `Give 1-week price predictions for NIFTY 50, BANK NIFTY, and SENSEX. Return ONLY this JSON:
{"NIFTY50":{"current":<number>,"target":<number>,"direction":"UP|DOWN","confidence":<0-100>},"BANKNIFTY":{"current":<number>,"target":<number>,"direction":"UP|DOWN","confidence":<0-100>},"SENSEX":{"current":<number>,"target":<number>,"direction":"UP|DOWN","confidence":<0-100>}}`;
    } else {
      userPrompt = prompt || 'Analyze current Indian stock market conditions. Return JSON with key insights.';
    }

    const response = await fetch(PERPLEXITY_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-large-128k-online',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Perplexity error:', response.status, errText);
      return NextResponse.json({ error: `AI API error: ${response.status}` }, { status: response.status });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Invalid AI response', raw: content }, { status: 500 });
    }
    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ success: true, data: parsed, type });

  } catch (error: any) {
    console.error('AI route error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'sentiment';

    if (action === 'sentiment') {
      // Match the exact shape aiService.ts expects:
      // response.status === 'success' -> response.data.sentiment
      return NextResponse.json({
        status: 'success',
        data: {
          sentiment: {
            overall: 'Bullish',
            confidence: 72,
            aiAnalysis: 'Market shows moderate bullish momentum with supportive technical indicators. NIFTY holding above key support levels with positive breadth.',
            factors: [
              { factor: 'Technical Indicators', sentiment: 'Bullish', weight: 35 },
              { factor: 'News Sentiment', sentiment: 'Neutral', weight: 25 },
              { factor: 'Volume Analysis', sentiment: 'Bullish', weight: 20 },
              { factor: 'Sector Rotation', sentiment: 'Neutral', weight: 20 }
            ]
          }
        }
      });
    }

    if (action === 'predictions') {
      return NextResponse.json({
        status: 'success',
        data: {
          predictions: [
            { symbol: 'NIFTY 50', currentPrice: 19850, predictedPrice: 20150, timeframe: '1 Week', confidence: 82, direction: 'up', probability: 78, keyLevels: { support: 19650, resistance: 20200 } },
            { symbol: 'BANK NIFTY', currentPrice: 44892, predictedPrice: 45800, timeframe: '1 Week', confidence: 75, direction: 'up', probability: 71, keyLevels: { support: 44200, resistance: 46000 } },
            { symbol: 'SENSEX', currentPrice: 66589, predictedPrice: 67500, timeframe: '1 Week', confidence: 79, direction: 'up', probability: 74, keyLevels: { support: 65800, resistance: 68000 } }
          ]
        }
      });
    }

    if (action === 'recommendations') {
      return NextResponse.json({
        status: 'success',
        data: {
          recommendations: [
            { symbol: 'RELIANCE', action: 'BUY', confidence: 89, aiScore: 8.7, targetPrice: 2650, currentPrice: 2485, timeframe: '2-4 weeks', reasoning: 'Strong technical breakout pattern with AI-detected volume accumulation.', riskFactors: ['Oil price volatility', 'Regulatory changes'], catalysts: ['Q3 earnings', 'New energy ventures update'] },
            { symbol: 'HDFC BANK', action: 'ACCUMULATE', confidence: 85, aiScore: 8.4, targetPrice: 1680, currentPrice: 1545, timeframe: '4-8 weeks', reasoning: 'Institutional accumulation pattern detected. Credit growth momentum expected.', riskFactors: ['Interest rate changes', 'Asset quality concerns'], catalysts: ['Merger synergies', 'Digital banking growth'] },
            { symbol: 'TCS', action: 'HOLD', confidence: 78, aiScore: 7.8, targetPrice: 3850, currentPrice: 3720, timeframe: '6-12 weeks', reasoning: 'Solid fundamentals with steady growth and balanced risk-reward profile.', riskFactors: ['IT spending slowdown', 'Currency fluctuations'], catalysts: ['Q3 results', 'Digital transformation deals'] }
          ]
        }
      });
    }

    if (action === 'patterns') {
      return NextResponse.json({
        status: 'success',
        data: {
          patterns: [
            { pattern: 'Cup and Handle', symbols: ['RELIANCE', 'HDFC BANK'], confidence: 85, expectedMove: 'Bullish', timeframe: '2-4 weeks', description: 'Classic cup and handle pattern indicating potential breakout', keyLevels: { breakout: 2500, stopLoss: 2400 } },
            { pattern: 'Ascending Triangle', symbols: ['TCS', 'INFOSYS'], confidence: 78, expectedMove: 'Bullish', timeframe: '1-2 weeks', description: 'Ascending triangle with higher lows and flat resistance', keyLevels: { breakout: 3800, stopLoss: 3600 } },
            { pattern: 'Bull Flag', symbols: ['HINDUNILVR', 'ITC'], confidence: 82, expectedMove: 'Bullish', timeframe: '1-3 weeks', description: 'Bull flag pattern after strong upward move', keyLevels: { breakout: 2800, stopLoss: 2700 } }
          ]
        }
      });
    }

    return NextResponse.json({ status: 'AI route active', action });
  } catch (error: any) {
    console.error('AI GET route error:', error);
    return NextResponse.json({ error: 'AI analysis failed' }, { status: 500 });
  }
}
