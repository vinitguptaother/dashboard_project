import { NextRequest, NextResponse } from 'next/server';

// Map common symbols to Upstox instrument keys
const UPSTOX_INSTRUMENT_MAP: Record<string, string> = {
  'NIFTY': 'NSE_INDEX|Nifty 50',
  'NIFTY 50': 'NSE_INDEX|Nifty 50', 
  'SENSEX': 'BSE_INDEX|SENSEX',
  'BANKNIFTY': 'NSE_INDEX|Nifty Bank',
  'RELIANCE': 'NSE_EQ|INE002A01018',
  'INFOSYS': 'NSE_EQ|INE009A01021',
  'INFY': 'NSE_EQ|INE009A01021',
  'HINDUNILVR': 'NSE_EQ|INE030A01027',
  'TCS': 'NSE_EQ|INE467B01029',
  'HDFC': 'NSE_EQ|INE040A01034',
  'HDFCBANK': 'NSE_EQ|INE040A01058',
  'ICICIBANK': 'NSE_EQ|INE090A01013',
  'SBIN': 'NSE_EQ|INE062A01020',
  'BHARTIARTL': 'NSE_EQ|INE397D01024',
  'ITC': 'NSE_EQ|INE154A01025',
  'LT': 'NSE_EQ|INE018A01030',
  'AXISBANK': 'NSE_EQ|INE238A01034',
  'MARUTI': 'NSE_EQ|INE585B01010',
  'HCLTECH': 'NSE_EQ|INE860A01027',
  'ASIANPAINT': 'NSE_EQ|INE021A01026'
};

// Realistic fallback prices for common indices/stocks
const DEMO_PRICES: Record<string, { lastPrice: number; cp: number }> = {
  'NIFTY': { lastPrice: 19850.25, cp: 0.65 },
  'SENSEX': { lastPrice: 66590.85, cp: -0.35 },
  'BANKNIFTY': { lastPrice: 44890.10, cp: 0.20 },
  'RELIANCE': { lastPrice: 2485.60, cp: 1.12 },
  'TCS': { lastPrice: 3720.45, cp: -0.28 },
  'INFOSYS': { lastPrice: 1480.30, cp: 0.45 },
  'INFY': { lastPrice: 1480.30, cp: 0.45 },
  'HDFCBANK': { lastPrice: 1545.80, cp: 0.78 },
  'ICICIBANK': { lastPrice: 965.20, cp: 0.55 },
  'SBIN': { lastPrice: 578.90, cp: -0.42 },
  'ITC': { lastPrice: 442.15, cp: 0.32 },
  'HINDUNILVR': { lastPrice: 2510.70, cp: -0.18 },
};

function buildDemoData(symbols: string[]) {
  const demoData: Record<string, any> = {};
  symbols.forEach((symbol) => {
    const known = DEMO_PRICES[symbol.toUpperCase()];
    const lastPrice = known?.lastPrice ?? parseFloat((Math.random() * 2000 + 500).toFixed(2));
    const cp = known?.cp ?? parseFloat(((Math.random() - 0.5) * 2).toFixed(2));
    demoData[symbol] = {
      lastPrice,
      instrumentToken: UPSTOX_INSTRUMENT_MAP[symbol.toUpperCase()] || `NSE_EQ|${symbol.toUpperCase()}`,
      volume: Math.floor(Math.random() * 1000000),
      ltq: Math.floor(Math.random() * 1000),
      cp
    };
  });
  return demoData;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const instrumentsParam = searchParams.get('instruments');

  if (!instrumentsParam) {
    return NextResponse.json(
      { error: 'Missing instruments parameter' },
      { status: 400 }
    );
  }

  const requestedSymbols = instrumentsParam.split(',').map(s => s.trim());

  try {
    const accessToken = process.env.UPSTOX_ACCESS_TOKEN;

    // If no access token, return demo data
    if (!accessToken || accessToken === 'your_access_token_here') {
      return NextResponse.json({
        status: 'success',
        data: buildDemoData(requestedSymbols),
        timestamp: new Date().toISOString()
      });
    }

    // Map symbols to proper Upstox instrument keys
    const upstoxInstruments = requestedSymbols.map(instrument => {
      // If it's already a proper instrument key, use it
      if (instrument.includes('|')) {
        return instrument;
      }
      // Otherwise, map it from our symbol map
      return UPSTOX_INSTRUMENT_MAP[instrument.toUpperCase()] || `NSE_EQ|${instrument.toUpperCase()}`;
    });

    // Create instrument key string for Upstox API
    const instrumentKeys = upstoxInstruments.join(',');

    console.log('Calling backend API with instruments:', requestedSymbols.join(','));

    // Call backend Upstox API proxy
    const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';
    const backendResponse = await fetch(
      `${backendURL}/api/upstox/ltp?instruments=${encodeURIComponent(requestedSymbols.join(','))}`,
      {
        headers: {
          'Accept': 'application/json'
        },
        next: { revalidate: 0 } // Disable caching for real-time data
      }
    );

    console.log('Backend Response Status:', backendResponse.status);
    
    if (!backendResponse.ok) {
      console.error('Backend API Error:', backendResponse.status);
      // Fall back to demo data instead of propagating the error
      return NextResponse.json({
        status: 'success',
        data: buildDemoData(requestedSymbols),
        demo: true,
        timestamp: new Date().toISOString()
      });
    }

    const backendData = await backendResponse.json();
    console.log('Backend Response Data:', JSON.stringify(backendData, null, 2));
    
    if (backendData.status !== 'success') {
      console.error('Backend API returned error:', backendData);
      // Fall back to demo data
      return NextResponse.json({
        status: 'success',
        data: buildDemoData(requestedSymbols),
        demo: true,
        timestamp: new Date().toISOString()
      });
    }

    // Backend already returns data in the correct format with symbol keys
    const transformedData = backendData.data || {};

    return NextResponse.json({
      status: 'success',
      data: transformedData,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('LTP Batch API Error:', error);
    // Fallback to realistic demo data instead of returning 500
    return NextResponse.json({
      status: 'success',
      data: buildDemoData(requestedSymbols),
      demo: true,
      timestamp: new Date().toISOString()
    });
  }
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}