/**
 * Live Quote Service
 * Handles real-time market data via REST API and WebSocket connections
 * Supports LTPC, Full Market Depth, and Option Greeks modes
 */

import type {
  LiveQuote,
  QuoteMode,
  MarketSegment,
  OptionGreeks,
  WebSocketStream,
  WebSocketSubscription,
  UpstoxQuoteResponse,
  UpstoxMarketDataError,
  Exchange,
  MarketSegmentStatus,
} from '../types/marketData';

import {
  buildApiUrl,
  buildAuthHeaders,
  buildWebSocketAuthPayload,
  ENDPOINTS,
  UPSTOX_WEBSOCKET_URL,
  WEBSOCKET_CONFIG,
  extractExchange,
  extractSymbol,
  isValidInstrumentKey,
} from '../config/marketDataConfig';

/**
 * LiveQuoteService - Fetch real-time market data
 */
export class LiveQuoteService {
  private accessToken: string;
  private wsConnection: WebSocket | null = null;
  private reconnectAttempts = 0;
  private subscriptions: Map<string, WebSocketSubscription> = new Map();

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Get live quote snapshot for a single instrument
   * @param instrumentKey - Format: "EXCHANGE|SYMBOL" (e.g., "NSE_EQ|RELIANCE")
   * @param mode - Quote mode: ltpc, full, or full_d30
   */
  async getLiveQuote(instrumentKey: string, mode: QuoteMode = 'ltpc'): Promise<LiveQuote> {
    if (!isValidInstrumentKey(instrumentKey)) {
      throw new UpstoxMarketDataError(`Invalid instrument key format: ${instrumentKey}`);
    }

    const url = buildApiUrl(ENDPOINTS.MARKET_QUOTE);
    const params = new URLSearchParams({
      instrument_key: instrumentKey,
    });

    try {
      const response = await fetch(`${url}?${params.toString()}`, {
        method: 'GET',
        headers: buildAuthHeaders(this.accessToken),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new UpstoxMarketDataError(
          `Failed to fetch quote for ${instrumentKey}`,
          response.status,
          errorData
        );
      }

      const data: UpstoxQuoteResponse = await response.json();
      return this.mapQuoteResponse(instrumentKey, data.data[instrumentKey], mode);
    } catch (error) {
      if (error instanceof UpstoxMarketDataError) {
        throw error;
      }
      throw new UpstoxMarketDataError(
        `Error fetching live quote: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get live quotes for multiple instruments (batch)
   * @param instrumentKeys - Array of instrument keys
   * @param mode - Quote mode
   */
  async getLiveQuotes(instrumentKeys: string[], mode: QuoteMode = 'ltpc'): Promise<LiveQuote[]> {
    const url = buildApiUrl(ENDPOINTS.MARKET_QUOTE);
    const params = new URLSearchParams({
      instrument_key: instrumentKeys.join(','),
    });

    try {
      const response = await fetch(`${url}?${params.toString()}`, {
        method: 'GET',
        headers: buildAuthHeaders(this.accessToken),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new UpstoxMarketDataError(
          'Failed to fetch quotes',
          response.status,
          errorData
        );
      }

      const data: UpstoxQuoteResponse = await response.json();
      
      return instrumentKeys.map((key) => 
        this.mapQuoteResponse(key, data.data[key], mode)
      );
    } catch (error) {
      if (error instanceof UpstoxMarketDataError) {
        throw error;
      }
      throw new UpstoxMarketDataError(
        `Error fetching live quotes: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get option Greeks for derivatives instruments
   * @param instrumentKeys - Array of option instrument keys
   */
  async getOptionGreeks(instrumentKeys: string[]): Promise<OptionGreeks[]> {
    const url = buildApiUrl(ENDPOINTS.OPTION_GREEKS);
    const params = new URLSearchParams({
      instrument_key: instrumentKeys.join(','),
    });

    try {
      const response = await fetch(`${url}?${params.toString()}`, {
        method: 'GET',
        headers: buildAuthHeaders(this.accessToken),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new UpstoxMarketDataError(
          'Failed to fetch option Greeks',
          response.status,
          errorData
        );
      }

      const data = await response.json();
      return this.mapGreeksResponse(data.data);
    } catch (error) {
      if (error instanceof UpstoxMarketDataError) {
        throw error;
      }
      throw new UpstoxMarketDataError(
        `Error fetching option Greeks: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get market status for all segments
   */
  async getMarketStatus(): Promise<MarketSegment[]> {
    const url = buildApiUrl(ENDPOINTS.MARKET_STATUS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: buildAuthHeaders(this.accessToken),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new UpstoxMarketDataError(
          'Failed to fetch market status',
          response.status,
          errorData
        );
      }

      const data = await response.json();
      return this.mapMarketStatusResponse(data.data);
    } catch (error) {
      if (error instanceof UpstoxMarketDataError) {
        throw error;
      }
      throw new UpstoxMarketDataError(
        `Error fetching market status: ${(error as Error).message}`
      );
    }
  }

  /**
   * Stream live quotes via WebSocket
   * @param subscription - WebSocket subscription config
   */
  streamLiveQuotes(subscription: WebSocketSubscription): WebSocketStream<LiveQuote[]> {
    const streamId = Date.now().toString();
    this.subscriptions.set(streamId, subscription);

    return {
      subscribe: () => this.connectWebSocket(streamId),
      unsubscribe: () => this.disconnectWebSocket(streamId),
      addInstruments: (keys: string[]) => this.addInstrumentsToStream(streamId, keys),
      removeInstruments: (keys: string[]) => this.removeInstrumentsFromStream(streamId, keys),
      close: () => this.closeWebSocket(),
      isConnected: () => this.wsConnection?.readyState === WebSocket.OPEN,
    };
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  /**
   * Map raw Upstox quote response to LiveQuote interface
   */
  private mapQuoteResponse(
    instrumentKey: string,
    rawData: UpstoxQuoteResponse['data'][string],
    mode: QuoteMode
  ): LiveQuote {
    const ltpc = rawData.ltpc || { ltp: 0, cp: 0, ltt: '', volume: 0 };
    const ohlc = rawData.ohlc || { open: 0, high: 0, low: 0, close: 0 };
    const depth = rawData.depth;

    const change = ltpc.ltp - ltpc.cp;
    const changePercent = ltpc.cp !== 0 ? (change / ltpc.cp) * 100 : 0;

    return {
      instrumentKey,
      symbol: extractSymbol(instrumentKey),
      exchange: extractExchange(instrumentKey) as Exchange,
      ltp: ltpc.ltp,
      previousClose: ltpc.cp,
      open: ohlc.open,
      high: ohlc.high,
      low: ohlc.low,
      close: ohlc.close,
      volume: ltpc.volume,
      vwap: 0, // Calculate if needed
      change,
      changePercent,
      lastTradeTime: ltpc.ltt,
      marketStatus: 'NORMAL_OPEN' as MarketSegmentStatus,
      depth: depth ? {
        bestBidPrice: depth.buy[0]?.price || 0,
        bestBidQty: depth.buy[0]?.quantity || 0,
        bestAskPrice: depth.sell[0]?.price || 0,
        bestAskQty: depth.sell[0]?.quantity || 0,
        totalBidQty: depth.buy.reduce((sum, b) => sum + b.quantity, 0),
        totalAskQty: depth.sell.reduce((sum, a) => sum + a.quantity, 0),
        bids: depth.buy.map(b => ({
          price: b.price,
          quantity: b.quantity,
          orders: b.orders,
        })),
        asks: depth.sell.map(a => ({
          price: a.price,
          quantity: a.quantity,
          orders: a.orders,
        })),
      } : undefined,
      greeks: rawData.greeks ? {
        instrumentKey,
        symbol: extractSymbol(instrumentKey),
        delta: rawData.greeks.delta,
        gamma: rawData.greeks.gamma,
        theta: rawData.greeks.theta,
        vega: rawData.greeks.vega,
        impliedVolatility: rawData.greeks.iv,
        rho: rawData.greeks.rho,
        underlyingPrice: 0,
        strikePrice: 0,
        daysToExpiry: 0,
      } : undefined,
    };
  }

  /**
   * Map Greeks response
   */
  private mapGreeksResponse(rawData: Record<string, unknown>): OptionGreeks[] {
    return Object.entries(rawData).map(([key, data]: [string, any]) => ({
      instrumentKey: key,
      symbol: extractSymbol(key),
      delta: data.delta || 0,
      gamma: data.gamma || 0,
      theta: data.theta || 0,
      vega: data.vega || 0,
      impliedVolatility: data.iv || 0,
      rho: data.rho || 0,
      underlyingPrice: data.underlying_spot || 0,
      strikePrice: data.strike || 0,
      daysToExpiry: data.days_to_expiry || 0,
    }));
  }

  /**
   * Map market status response
   */
  private mapMarketStatusResponse(rawData: Record<string, unknown>[]): MarketSegment[] {
    return rawData.map((item: any) => ({
      exchange: item.exchange as Exchange,
      segment: item.segment,
      status: item.status as MarketSegmentStatus,
      lastUpdateTime: new Date().toISOString(),
    }));
  }

  /**
   * Connect to WebSocket
   */
  private connectWebSocket(streamId: string): void {
    if (this.wsConnection?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      this.wsConnection = new WebSocket(UPSTOX_WEBSOCKET_URL);

      this.wsConnection.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        
        // Send authorization
        const authPayload = buildWebSocketAuthPayload(this.accessToken);
        this.wsConnection?.send(JSON.stringify(authPayload));

        // Subscribe to instruments
        const subscription = this.subscriptions.get(streamId);
        if (subscription) {
          this.subscribeToInstruments(subscription.instrumentKeys, subscription.mode);
          subscription.onConnect?.();
        }
      };

      this.wsConnection.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(streamId, data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.wsConnection.onerror = (error) => {
        console.error('WebSocket error:', error);
        const subscription = this.subscriptions.get(streamId);
        subscription?.onError(new Error('WebSocket connection error'));
      };

      this.wsConnection.onclose = () => {
        console.log('WebSocket closed');
        const subscription = this.subscriptions.get(streamId);
        subscription?.onDisconnect?.();
        
        // Attempt reconnection
        if (this.reconnectAttempts < WEBSOCKET_CONFIG.MAX_RECONNECT_ATTEMPTS) {
          this.reconnectAttempts++;
          setTimeout(
            () => this.connectWebSocket(streamId),
            WEBSOCKET_CONFIG.RECONNECT_INTERVAL
          );
        }
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      throw new UpstoxMarketDataError('WebSocket connection failed');
    }
  }

  /**
   * Subscribe to instruments
   */
  private subscribeToInstruments(instrumentKeys: string[], mode: QuoteMode): void {
    if (!this.wsConnection || this.wsConnection.readyState !== WebSocket.OPEN) {
      return;
    }

    const subscribePayload = {
      guid: 'someguid',
      method: 'sub',
      data: {
        mode: mode,
        instrumentKeys: instrumentKeys,
      },
    };

    this.wsConnection.send(JSON.stringify(subscribePayload));
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleWebSocketMessage(streamId: string, data: unknown): void {
    const subscription = this.subscriptions.get(streamId);
    if (!subscription) return;

    // Parse and transform WebSocket data to LiveQuote format
    // Implementation depends on Upstox WebSocket message format
    try {
      const quotes: LiveQuote[] = this.parseWebSocketData(data);
      subscription.onData(quotes);
    } catch (error) {
      subscription.onError(error as Error);
    }
  }

  /**
   * Parse WebSocket data (stub - implement based on actual WS format)
   */
  private parseWebSocketData(data: unknown): LiveQuote[] {
    // TODO: Implement actual WebSocket data parsing based on Upstox format
    return [];
  }

  /**
   * Add instruments to existing stream
   */
  private addInstrumentsToStream(streamId: string, instrumentKeys: string[]): void {
    const subscription = this.subscriptions.get(streamId);
    if (!subscription) return;

    subscription.instrumentKeys.push(...instrumentKeys);
    this.subscribeToInstruments(instrumentKeys, subscription.mode);
  }

  /**
   * Remove instruments from stream
   */
  private removeInstrumentsFromStream(streamId: string, instrumentKeys: string[]): void {
    const subscription = this.subscriptions.get(streamId);
    if (!subscription || !this.wsConnection) return;

    subscription.instrumentKeys = subscription.instrumentKeys.filter(
      (key) => !instrumentKeys.includes(key)
    );

    const unsubscribePayload = {
      guid: 'someguid',
      method: 'unsub',
      data: {
        mode: subscription.mode,
        instrumentKeys: instrumentKeys,
      },
    };

    this.wsConnection.send(JSON.stringify(unsubscribePayload));
  }

  /**
   * Disconnect specific stream
   */
  private disconnectWebSocket(streamId: string): void {
    this.subscriptions.delete(streamId);
    
    if (this.subscriptions.size === 0) {
      this.closeWebSocket();
    }
  }

  /**
   * Close WebSocket connection
   */
  private closeWebSocket(): void {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
  }
}
