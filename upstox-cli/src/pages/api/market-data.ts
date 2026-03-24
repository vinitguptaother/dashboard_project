/**
 * Next.js API Route: Market Data
 * Exposes Upstox market data services to frontend
 * 
 * Endpoints:
 * - GET /api/market-data?type=live&instrumentKeys=NSE_EQ|RELIANCE&mode=ltpc
 * - GET /api/market-data?type=historical&instrumentKey=NSE_EQ|RELIANCE&interval=day&fromDate=2024-01-01&toDate=2024-12-31
 * - GET /api/market-data?type=instruments&query=RELIANCE
 * - GET /api/market-data?type=optionChain&underlyingSymbol=NIFTY&expiryDate=2024-12-28
 * - GET /api/market-data?type=greeks&instrumentKeys=NSE_FO|NIFTY24DEC24000CE
 * - GET /api/market-data?type=marketStatus
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import UpstoxMarketDataClient, { UpstoxMarketDataError } from '../../upstox/services';
import type {
  LiveQuote,
  Candle,
  Instrument,
  OptionChainRow,
  OptionGreeks,
  MarketSegment,
  QuoteMode,
  CandleInterval,
} from '../../upstox/services';

// Type for API response
type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
};

/**
 * Market Data API Handler
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      timestamp: new Date().toISOString(),
    });
  }

  try {
    // Get access token from environment or request headers
    const accessToken =
      req.headers.authorization?.replace('Bearer ', '') ||
      process.env.UPSTOX_ACCESS_TOKEN ||
      process.env.UPSTOX_TOKEN;

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Access token not provided',
        timestamp: new Date().toISOString(),
      });
    }

    // Initialize market data client
    const client = new UpstoxMarketDataClient(accessToken);

    const { type } = req.query;

    // Route based on data type
    switch (type) {
      case 'live':
        return await handleLiveQuotes(client, req, res);

      case 'historical':
        return await handleHistoricalData(client, req, res);

      case 'instruments':
        return await handleInstruments(client, req, res);

      case 'optionChain':
        return await handleOptionChain(client, req, res);

      case 'greeks':
        return await handleGreeks(client, req, res);

      case 'marketStatus':
        return await handleMarketStatus(client, req, res);

      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid type parameter. Must be one of: live, historical, instruments, optionChain, greeks, marketStatus',
          timestamp: new Date().toISOString(),
        });
    }
  } catch (error) {
    console.error('Market data API error:', error);

    if (error instanceof UpstoxMarketDataError) {
      return res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
}

// ============================================
// HANDLER FUNCTIONS
// ============================================

/**
 * Handle live quotes request
 * Query params: instrumentKeys (comma-separated), mode (optional)
 */
async function handleLiveQuotes(
  client: UpstoxMarketDataClient,
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<LiveQuote | LiveQuote[]>>
) {
  const { instrumentKeys, instrumentKey, mode = 'ltpc' } = req.query;

  if (!instrumentKeys && !instrumentKey) {
    return res.status(400).json({
      success: false,
      error: 'instrumentKeys or instrumentKey parameter is required',
      timestamp: new Date().toISOString(),
    });
  }

  const keys = instrumentKeys
    ? (instrumentKeys as string).split(',')
    : [instrumentKey as string];

  const quotes =
    keys.length === 1
      ? await client.liveQuotes.getLiveQuote(keys[0], mode as QuoteMode)
      : await client.liveQuotes.getLiveQuotes(keys, mode as QuoteMode);

  return res.status(200).json({
    success: true,
    data: quotes,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Handle historical candles request
 * Query params: instrumentKey, interval, fromDate, toDate
 */
async function handleHistoricalData(
  client: UpstoxMarketDataClient,
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<Candle[]>>
) {
  const { instrumentKey, interval, fromDate, toDate } = req.query;

  if (!instrumentKey || !interval || !fromDate || !toDate) {
    return res.status(400).json({
      success: false,
      error: 'instrumentKey, interval, fromDate, and toDate parameters are required',
      timestamp: new Date().toISOString(),
    });
  }

  const candles = await client.historical.getHistoricalCandles({
    instrumentKey: instrumentKey as string,
    interval: interval as CandleInterval,
    fromDate: fromDate as string,
    toDate: toDate as string,
  });

  return res.status(200).json({
    success: true,
    data: candles,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Handle instruments search request
 * Query params: query, exchange (optional), instrumentType (optional), limit (optional)
 */
async function handleInstruments(
  client: UpstoxMarketDataClient,
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<Instrument[]>>
) {
  const { query, exchange, instrumentType, limit = '50' } = req.query;

  if (!query) {
    return res.status(400).json({
      success: false,
      error: 'query parameter is required',
      timestamp: new Date().toISOString(),
    });
  }

  const instruments = await client.instruments.searchInstrument({
    query: query as string,
    exchange: exchange as any,
    instrumentType: instrumentType as any,
    limit: parseInt(limit as string, 10),
  });

  return res.status(200).json({
    success: true,
    data: instruments,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Handle option chain request
 * Query params: underlyingSymbol, expiryDate, strikeMin (optional), strikeMax (optional)
 */
async function handleOptionChain(
  client: UpstoxMarketDataClient,
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<OptionChainRow[]>>
) {
  const { underlyingSymbol, expiryDate, strikeMin, strikeMax } = req.query;

  if (!underlyingSymbol || !expiryDate) {
    return res.status(400).json({
      success: false,
      error: 'underlyingSymbol and expiryDate parameters are required',
      timestamp: new Date().toISOString(),
    });
  }

  const strikeRange =
    strikeMin && strikeMax
      ? {
          min: parseFloat(strikeMin as string),
          max: parseFloat(strikeMax as string),
        }
      : undefined;

  const optionChain = await client.options.buildOptionChain({
    underlyingSymbol: underlyingSymbol as string,
    expiryDate: expiryDate as string,
    strikeRange,
  });

  return res.status(200).json({
    success: true,
    data: optionChain,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Handle option Greeks request
 * Query params: instrumentKeys (comma-separated)
 */
async function handleGreeks(
  client: UpstoxMarketDataClient,
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<OptionGreeks[]>>
) {
  const { instrumentKeys } = req.query;

  if (!instrumentKeys) {
    return res.status(400).json({
      success: false,
      error: 'instrumentKeys parameter is required',
      timestamp: new Date().toISOString(),
    });
  }

  const keys = (instrumentKeys as string).split(',');
  const greeks = await client.liveQuotes.getOptionGreeks(keys);

  return res.status(200).json({
    success: true,
    data: greeks,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Handle market status request
 */
async function handleMarketStatus(
  client: UpstoxMarketDataClient,
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<MarketSegment[]>>
) {
  const status = await client.liveQuotes.getMarketStatus();

  return res.status(200).json({
    success: true,
    data: status,
    timestamp: new Date().toISOString(),
  });
}
