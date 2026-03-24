import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  UPSTOX_CONFIG,
  createAuthHeaders,
  buildUrl,
  formatInstrumentKeys,
  formatHistoricalDate,
  buildHistoricalCandleUrl,
} from './config';
import type {
  UpstoxLTPResponse,
  UpstoxMarketQuoteResponse,
  UpstoxHistoricalCandleResponse,
  UpstoxHoldingsResponse,
  UpstoxPositionsResponse,
  UpstoxFundsResponse,
  LiveQuote,
  HistoricalCandle,
  HistoricalCandleParams,
  Holding,
  Position,
  PortfolioHoldingsSnapshot,
  PortfolioPositionsSnapshot,
  PortfolioSnapshot,
} from './types';

// ============================================
// UPSTOX DATA SERVICE
// ============================================

export class UpstoxDataService {
  private accessToken: string;
  private axiosInstance: AxiosInstance;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
    this.axiosInstance = axios.create({
      timeout: UPSTOX_CONFIG.REQUEST_TIMEOUT,
      headers: createAuthHeaders(accessToken),
    });
  }

  // ============================================
  // LIVE QUOTES
  // ============================================

  /**
   * Fetches live quotes with OHLC and depth for given instruments
   * @param instrumentKeys - Array of instrument keys (e.g., ['NSE_EQ|INE002A01018'])
   * @returns Promise of LiveQuote array
   */
  async getLiveQuotes(instrumentKeys: string[]): Promise<LiveQuote[]> {
    try {
      const url = buildUrl(UPSTOX_CONFIG.ENDPOINTS.MARKET_QUOTE_FULL, {
        instrument_key: formatInstrumentKeys(instrumentKeys),
      });

      const response: AxiosResponse<UpstoxMarketQuoteResponse> = await this.axiosInstance.get(url);

      if (response.data.status !== 'success') {
        throw new Error('Failed to fetch live quotes');
      }

      return this.normalizeLiveQuotes(response.data, instrumentKeys);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Upstox API error: ${error.response?.status} - ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Fetches only LTP (Last Traded Price) for given instruments
   * @param instrumentKeys - Array of instrument keys
   * @returns Promise of object mapping instrument key to LTP
   */
  async getLTP(instrumentKeys: string[]): Promise<Record<string, number>> {
    try {
      const url = buildUrl(UPSTOX_CONFIG.ENDPOINTS.MARKET_QUOTE_LTP, {
        instrument_key: formatInstrumentKeys(instrumentKeys),
      });

      const response: AxiosResponse<UpstoxLTPResponse> = await this.axiosInstance.get(url);

      if (response.data.status !== 'success') {
        throw new Error('Failed to fetch LTP');
      }

      const result: Record<string, number> = {};
      for (const [key, value] of Object.entries(response.data.data)) {
        result[key] = value.last_price;
      }

      return result;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Upstox API error: ${error.response?.status} - ${error.message}`);
      }
      throw error;
    }
  }

  // ============================================
  // HISTORICAL CANDLES
  // ============================================

  /**
   * Fetches historical candle data for a single instrument
   * @param params - Historical candle parameters
   * @returns Promise of HistoricalCandle array
   */
  async getHistoricalCandles(params: HistoricalCandleParams): Promise<HistoricalCandle[]> {
    try {
      const toDate = formatHistoricalDate(params.to);
      const fromDate = formatHistoricalDate(params.from);

      const url = buildHistoricalCandleUrl(
        params.instrumentKey,
        params.interval,
        toDate,
        fromDate
      );

      const response: AxiosResponse<UpstoxHistoricalCandleResponse> = await this.axiosInstance.get(url);

      if (response.data.status !== 'success') {
        throw new Error('Failed to fetch historical candles');
      }

      return this.normalizeHistoricalCandles(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Upstox API error: ${error.response?.status} - ${error.message}`);
      }
      throw error;
    }
  }

  // ============================================
  // HOLDINGS
  // ============================================

  /**
   * Fetches long-term holdings with computed P&L
   * @returns Promise of Holding array
   */
  async getHoldings(): Promise<Holding[]> {
    try {
      const url = buildUrl(UPSTOX_CONFIG.ENDPOINTS.HOLDINGS);

      const response: AxiosResponse<UpstoxHoldingsResponse> = await this.axiosInstance.get(url);

      if (response.data.status !== 'success') {
        throw new Error('Failed to fetch holdings');
      }

      return this.normalizeHoldings(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Upstox API error: ${error.response?.status} - ${error.message}`);
      }
      throw error;
    }
  }

  // ============================================
  // POSITIONS
  // ============================================

  /**
   * Fetches short-term positions with computed P&L
   * @returns Promise of Position array
   */
  async getPositions(): Promise<Position[]> {
    try {
      const url = buildUrl(UPSTOX_CONFIG.ENDPOINTS.POSITIONS);

      const response: AxiosResponse<UpstoxPositionsResponse> = await this.axiosInstance.get(url);

      if (response.data.status !== 'success') {
        throw new Error('Failed to fetch positions');
      }

      return this.normalizePositions(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Upstox API error: ${error.response?.status} - ${error.message}`);
      }
      throw error;
    }
  }

  // ============================================
  // PORTFOLIO SNAPSHOT (combined holdings + positions + funds)
  // ============================================

  /**
   * Fetches complete portfolio snapshot with holdings, positions, and funds
   * @returns Promise of PortfolioSnapshot
   */
  async getPortfolioSnapshot(): Promise<PortfolioSnapshot> {
    try {
      // Fetch all data in parallel
      const [holdings, positions, fundsResponse] = await Promise.all([
        this.getHoldings(),
        this.getPositions(),
        this.getFunds(),
      ]);

      const holdingsSnapshot = this.buildHoldingsSnapshot(holdings);
      const positionsSnapshot = this.buildPositionsSnapshot(positions);

      const totalPortfolioValue =
        holdingsSnapshot.summary.totalCurrentValue + positionsSnapshot.summary.totalValue;
      const totalPnL = holdingsSnapshot.summary.totalPnL + positionsSnapshot.summary.totalPnL;

      return {
        holdings: holdingsSnapshot,
        positions: positionsSnapshot,
        funds: fundsResponse
          ? {
              equityAvailableMargin: fundsResponse.data.equity.available_margin,
              equityUsedMargin: fundsResponse.data.equity.used_margin,
              commodityAvailableMargin: fundsResponse.data.commodity.available_margin,
              commodityUsedMargin: fundsResponse.data.commodity.used_margin,
            }
          : undefined,
        totalPortfolioValue,
        totalPnL,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Upstox API error: ${error.response?.status} - ${error.message}`);
      }
      throw error;
    }
  }

  // ============================================
  // PRIVATE HELPER - FUNDS
  // ============================================

  private async getFunds(): Promise<UpstoxFundsResponse> {
    const url = buildUrl(UPSTOX_CONFIG.ENDPOINTS.FUNDS);
    const response: AxiosResponse<UpstoxFundsResponse> = await this.axiosInstance.get(url);

    if (response.data.status !== 'success') {
      throw new Error('Failed to fetch funds');
    }

    return response.data;
  }

  // ============================================
  // NORMALIZATION HELPERS
  // ============================================

  private normalizeLiveQuotes(
    response: UpstoxMarketQuoteResponse,
    instrumentKeys: string[]
  ): LiveQuote[] {
    const quotes: LiveQuote[] = [];

    for (const key of instrumentKeys) {
      const rawData = response.data[key];
      if (!rawData) continue;

      const ltpc = rawData.ltpc;
      const ohlc = rawData.ohlc;
      const depth = rawData.depth;

      // Extract symbol from instrument key (e.g., NSE_EQ|INE002A01018 -> INE002A01018)
      const symbol = key.split('|')[1] || key;

      let depthSummary;
      if (depth && depth.buy.length > 0 && depth.sell.length > 0) {
        const totalBuyQty = depth.buy.reduce((sum, item) => sum + item.quantity, 0);
        const totalSellQty = depth.sell.reduce((sum, item) => sum + item.quantity, 0);
        const bestBid = depth.buy[0].price;
        const bestAsk = depth.sell[0].price;

        depthSummary = {
          totalBuyQuantity: totalBuyQty,
          totalSellQuantity: totalSellQty,
          bestBid,
          bestAsk,
          spread: bestAsk - bestBid,
        };
      }

      quotes.push({
        instrumentKey: key,
        symbol,
        ltp: ltpc?.ltp || 0,
        open: ohlc?.open || 0,
        high: ohlc?.high || 0,
        low: ohlc?.low || 0,
        close: ohlc?.close || 0,
        volume: ltpc?.volume || 0,
        lastTradeTime: ltpc?.ltt,
        depth: depthSummary,
      });
    }

    return quotes;
  }

  private normalizeHistoricalCandles(response: UpstoxHistoricalCandleResponse): HistoricalCandle[] {
    return response.data.candles.map((candle) => ({
      timestamp: candle[0],
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
      volume: candle[5],
      openInterest: candle[6] || undefined,
    }));
  }

  private normalizeHoldings(response: UpstoxHoldingsResponse): Holding[] {
    return response.data.map((holding) => {
      const currentValue = holding.quantity * holding.last_price;
      const investmentValue = holding.quantity * holding.average_price;
      const pnlPercentage = investmentValue !== 0 ? (holding.pnl / investmentValue) * 100 : 0;

      return {
        symbol: holding.tradingsymbol,
        isin: holding.isin,
        exchange: holding.exchange,
        companyName: holding.company_name,
        quantity: holding.quantity,
        averagePrice: holding.average_price,
        lastPrice: holding.last_price,
        closePrice: holding.close_price,
        currentValue,
        investmentValue,
        pnl: holding.pnl,
        pnlPercentage,
        dayChange: holding.day_change,
        dayChangePercentage: holding.day_change_percentage,
        t1Quantity: holding.t1_quantity,
        instrumentToken: holding.instrument_token,
      };
    });
  }

  private normalizePositions(response: UpstoxPositionsResponse): Position[] {
    return response.data.map((position) => ({
      symbol: position.tradingsymbol,
      exchange: position.exchange,
      product: position.product,
      quantity: position.quantity,
      overnightQuantity: position.overnight_quantity,
      multiplier: position.multiplier,
      averagePrice: position.average_price,
      buyPrice: position.buy_price,
      sellPrice: position.sell_price,
      lastPrice: position.last_price,
      closePrice: position.close_price,
      pnl: position.pnl,
      realised: position.realised,
      unrealised: position.unrealised,
      value: position.value,
      dayBuyQuantity: position.day_buy_quantity,
      daySellQuantity: position.day_sell_quantity,
      instrumentToken: position.instrument_token,
    }));
  }

  private buildHoldingsSnapshot(holdings: Holding[]): PortfolioHoldingsSnapshot {
    const summary = holdings.reduce(
      (acc, holding) => ({
        totalInvestmentValue: acc.totalInvestmentValue + holding.investmentValue,
        totalCurrentValue: acc.totalCurrentValue + holding.currentValue,
        totalPnL: acc.totalPnL + holding.pnl,
        totalDayChange: acc.totalDayChange + holding.dayChange,
        holdingsCount: acc.holdingsCount + 1,
      }),
      {
        totalInvestmentValue: 0,
        totalCurrentValue: 0,
        totalPnL: 0,
        totalDayChange: 0,
        holdingsCount: 0,
      }
    );

    const totalPnLPercentage =
      summary.totalInvestmentValue !== 0
        ? (summary.totalPnL / summary.totalInvestmentValue) * 100
        : 0;

    const totalDayChangePercentage =
      summary.totalCurrentValue !== 0
        ? (summary.totalDayChange / summary.totalCurrentValue) * 100
        : 0;

    return {
      holdings,
      summary: {
        ...summary,
        totalPnLPercentage,
        totalDayChangePercentage,
      },
      timestamp: new Date().toISOString(),
    };
  }

  private buildPositionsSnapshot(positions: Position[]): PortfolioPositionsSnapshot {
    const summary = positions.reduce(
      (acc, position) => ({
        totalPnL: acc.totalPnL + position.pnl,
        totalRealisedPnL: acc.totalRealisedPnL + position.realised,
        totalUnrealisedPnL: acc.totalUnrealisedPnL + position.unrealised,
        totalValue: acc.totalValue + position.value,
        positionsCount: acc.positionsCount + 1,
        longPositions: position.quantity > 0 ? acc.longPositions + 1 : acc.longPositions,
        shortPositions: position.quantity < 0 ? acc.shortPositions + 1 : acc.shortPositions,
      }),
      {
        totalPnL: 0,
        totalRealisedPnL: 0,
        totalUnrealisedPnL: 0,
        totalValue: 0,
        positionsCount: 0,
        longPositions: 0,
        shortPositions: 0,
      }
    );

    return {
      positions,
      summary,
      timestamp: new Date().toISOString(),
    };
  }
}
