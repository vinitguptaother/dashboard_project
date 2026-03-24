import { NextRequest, NextResponse } from 'next/server';
import { UpstoxDataService } from '@/src/upstox/service';
import type { DataType, HistoricalCandleParams } from '@/src/upstox/types';

// ============================================
// GET HANDLER - Main Upstox Data API Route
// ============================================

export async function GET(request: NextRequest) {
  try {
    // Extract query parameters
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') as DataType | null;
    const accessToken = searchParams.get('accessToken') || process.env.UPSTOX_ACCESS_TOKEN;

    // Validate required parameters
    if (!type) {
      return NextResponse.json(
        { error: 'Missing required parameter: type', validTypes: ['live', 'historical', 'holdings', 'positions', 'portfolioSnapshot'] },
        { status: 400 }
      );
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Missing Upstox access token. Provide via query param or environment variable.' },
        { status: 401 }
      );
    }

    // Initialize service
    const service = new UpstoxDataService(accessToken);

    // Route to appropriate handler based on type
    switch (type) {
      case 'live': {
        const instrumentKeys = searchParams.get('instrumentKeys')?.split(',') || [];
        
        if (instrumentKeys.length === 0) {
          return NextResponse.json(
            { error: 'Missing instrumentKeys parameter. Provide comma-separated instrument keys.' },
            { status: 400 }
          );
        }

        const quotes = await service.getLiveQuotes(instrumentKeys);
        return NextResponse.json({ success: true, data: quotes });
      }

      case 'historical': {
        const instrumentKey = searchParams.get('instrumentKey');
        const interval = searchParams.get('interval') as HistoricalCandleParams['interval'] | null;
        const fromDate = searchParams.get('from');
        const toDate = searchParams.get('to');

        if (!instrumentKey || !interval || !fromDate || !toDate) {
          return NextResponse.json(
            {
              error: 'Missing parameters for historical data',
              required: {
                instrumentKey: 'string (e.g., NSE_EQ|INE002A01018)',
                interval: 'string (1minute | 30minute | day | week | month)',
                from: 'string (ISO date or YYYY-MM-DD)',
                to: 'string (ISO date or YYYY-MM-DD)',
              },
            },
            { status: 400 }
          );
        }

        const params: HistoricalCandleParams = {
          instrumentKey,
          interval,
          from: new Date(fromDate),
          to: new Date(toDate),
        };

        const candles = await service.getHistoricalCandles(params);
        return NextResponse.json({ success: true, data: candles });
      }

      case 'holdings': {
        const holdings = await service.getHoldings();
        return NextResponse.json({ success: true, data: holdings });
      }

      case 'positions': {
        const positions = await service.getPositions();
        return NextResponse.json({ success: true, data: positions });
      }

      case 'portfolioSnapshot': {
        const snapshot = await service.getPortfolioSnapshot();
        return NextResponse.json({ success: true, data: snapshot });
      }

      default: {
        return NextResponse.json(
          {
            error: `Invalid type: ${type}`,
            validTypes: ['live', 'historical', 'holdings', 'positions', 'portfolioSnapshot'],
          },
          { status: 400 }
        );
      }
    }
  } catch (error: any) {
    console.error('[Upstox Data API] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

// ============================================
// EXAMPLE USAGE DOCUMENTATION
// ============================================

/*
API Endpoint: GET /api/upstox-data

Query Parameters:
- type (required): "live" | "historical" | "holdings" | "positions" | "portfolioSnapshot"
- accessToken (optional): Upstox access token (defaults to env var UPSTOX_ACCESS_TOKEN)

TYPE-SPECIFIC PARAMETERS:

1. Live Quotes (type=live):
   - instrumentKeys (required): Comma-separated instrument keys
   Example: /api/upstox-data?type=live&instrumentKeys=NSE_EQ|INE002A01018,NSE_EQ|INE040A01034

2. Historical Candles (type=historical):
   - instrumentKey (required): Single instrument key
   - interval (required): "1minute" | "30minute" | "day" | "week" | "month"
   - from (required): Start date (ISO or YYYY-MM-DD)
   - to (required): End date (ISO or YYYY-MM-DD)
   Example: /api/upstox-data?type=historical&instrumentKey=NSE_EQ|INE002A01018&interval=day&from=2025-01-01&to=2025-12-30

3. Holdings (type=holdings):
   - No additional parameters
   Example: /api/upstox-data?type=holdings

4. Positions (type=positions):
   - No additional parameters
   Example: /api/upstox-data?type=positions

5. Portfolio Snapshot (type=portfolioSnapshot):
   - No additional parameters
   - Returns combined holdings, positions, and funds data
   Example: /api/upstox-data?type=portfolioSnapshot

RESPONSE FORMAT:
{
  "success": true,
  "data": <type-specific data>
}

ERROR FORMAT:
{
  "success": false,
  "error": "<error message>"
}
*/
