/**
 * Options Service
 * Handles option chain construction, Greeks analysis, and options strategies
 * Combines data from InstrumentService, LiveQuoteService, and Greeks APIs
 */

import type {
  OptionChainRow,
  OptionChainLeg,
  OptionChainParams,
  OptionGreeks,
  Exchange,
  UpstoxMarketDataError,
} from '../types/marketData';

import { LiveQuoteService } from './liveQuoteService';
import { InstrumentService } from './instrumentService';

/**
 * OptionsService - Advanced options analysis
 */
export class OptionsService {
  private accessToken: string;
  private liveQuoteService: LiveQuoteService;
  private instrumentService: InstrumentService;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
    this.liveQuoteService = new LiveQuoteService(accessToken);
    this.instrumentService = new InstrumentService(accessToken);
  }

  /**
   * Build complete option chain for an underlying
   * @param params - Option chain parameters
   */
  async buildOptionChain(params: OptionChainParams): Promise<OptionChainRow[]> {
    const { underlyingSymbol, expiryDate, strikeRange } = params;
    const exchange: Exchange = 'NSE_EQ'; // Default to NSE

    try {
      // Get option contracts for the underlying
      const contracts = await this.instrumentService.getOptionContractsByExpiryAndStrike(
        underlyingSymbol,
        expiryDate,
        strikeRange,
        exchange
      );

      if (contracts.length === 0) {
        throw new UpstoxMarketDataError(
          `No option contracts found for ${underlyingSymbol} expiry ${expiryDate}`
        );
      }

      // Group by strike price
      const strikeMap = new Map<number, { calls: typeof contracts; puts: typeof contracts }>();

      contracts.forEach((contract) => {
        if (!strikeMap.has(contract.strikePrice)) {
          strikeMap.set(contract.strikePrice, { calls: [], puts: [] });
        }

        const group = strikeMap.get(contract.strikePrice)!;
        if (contract.optionType === 'CE') {
          group.calls.push(contract);
        } else {
          group.puts.push(contract);
        }
      });

      // Get live quotes and Greeks for all contracts
      const allInstrumentKeys = contracts.map((c) => c.instrumentKey);
      
      const [quotes, greeks] = await Promise.all([
        this.liveQuoteService.getLiveQuotes(allInstrumentKeys, 'full').catch(() => []),
        this.liveQuoteService.getOptionGreeks(allInstrumentKeys).catch(() => []),
      ]);

      // Build option chain rows
      const chainRows: OptionChainRow[] = [];
      const strikes = Array.from(strikeMap.keys()).sort((a, b) => a - b);

      for (const strike of strikes) {
        const { calls, puts } = strikeMap.get(strike)!;
        
        const callContract = calls[0];
        const putContract = puts[0];

        if (!callContract || !putContract) continue;

        const callQuote = quotes.find((q) => q.instrumentKey === callContract.instrumentKey);
        const putQuote = quotes.find((q) => q.instrumentKey === putContract.instrumentKey);

        const callGreeks = greeks.find((g) => g.instrumentKey === callContract.instrumentKey);
        const putGreeks = greeks.find((g) => g.instrumentKey === putContract.instrumentKey);

        const call: OptionChainLeg = {
          instrumentKey: callContract.instrumentKey,
          symbol: callContract.symbol,
          ltp: callQuote?.ltp || 0,
          openInterest: 0, // Get from additional API if available
          volume: callQuote?.volume || 0,
          changeInOI: 0,
          impliedVolatility: callGreeks?.impliedVolatility || 0,
          delta: callGreeks?.delta || 0,
          gamma: callGreeks?.gamma || 0,
          theta: callGreeks?.theta || 0,
          vega: callGreeks?.vega || 0,
          bidPrice: callQuote?.depth?.bestBidPrice || 0,
          askPrice: callQuote?.depth?.bestAskPrice || 0,
          bidQty: callQuote?.depth?.bestBidQty || 0,
          askQty: callQuote?.depth?.bestAskQty || 0,
        };

        const put: OptionChainLeg = {
          instrumentKey: putContract.instrumentKey,
          symbol: putContract.symbol,
          ltp: putQuote?.ltp || 0,
          openInterest: 0,
          volume: putQuote?.volume || 0,
          changeInOI: 0,
          impliedVolatility: putGreeks?.impliedVolatility || 0,
          delta: putGreeks?.delta || 0,
          gamma: putGreeks?.gamma || 0,
          theta: putGreeks?.theta || 0,
          vega: putGreeks?.vega || 0,
          bidPrice: putQuote?.depth?.bestBidPrice || 0,
          askPrice: putQuote?.depth?.bestAskPrice || 0,
          bidQty: putQuote?.depth?.bestBidQty || 0,
          askQty: putQuote?.depth?.bestAskQty || 0,
        };

        chainRows.push({
          strikePrice: strike,
          call,
          put,
          openInterestDiff: put.openInterest - call.openInterest,
        });
      }

      return chainRows;
    } catch (error) {
      if (error instanceof UpstoxMarketDataError) {
        throw error;
      }
      throw new UpstoxMarketDataError(
        `Error building option chain: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get option Greeks for specific strikes
   * @param instrumentKeys - Array of option instrument keys
   */
  async getOptionGreeksForStrikes(instrumentKeys: string[]): Promise<OptionGreeks[]> {
    if (instrumentKeys.length === 0) {
      return [];
    }

    // Batch requests in groups of 50 (API limit)
    const batchSize = 50;
    const batches: string[][] = [];

    for (let i = 0; i < instrumentKeys.length; i += batchSize) {
      batches.push(instrumentKeys.slice(i, i + batchSize));
    }

    try {
      const results = await Promise.all(
        batches.map((batch) => this.liveQuoteService.getOptionGreeks(batch))
      );

      return results.flat();
    } catch (error) {
      if (error instanceof UpstoxMarketDataError) {
        throw error;
      }
      throw new UpstoxMarketDataError(
        `Error fetching Greeks for strikes: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get ATM (At The Money) strike for an underlying
   * @param underlyingSymbol - Underlying symbol
   * @param expiryDate - Expiry date
   */
  async getATMStrike(
    underlyingSymbol: string,
    expiryDate: string,
    exchange: Exchange = 'NSE_EQ'
  ): Promise<number> {
    try {
      // Get underlying spot price
      const underlyingKey = `${exchange}|${underlyingSymbol}`;
      const quote = await this.liveQuoteService.getLiveQuote(underlyingKey);

      // Get available strikes
      const strikes = await this.instrumentService.getStrikePrices(
        underlyingSymbol,
        expiryDate,
        exchange
      );

      // Find closest strike to spot price
      const atmStrike = strikes.reduce((prev, curr) =>
        Math.abs(curr - quote.ltp) < Math.abs(prev - quote.ltp) ? curr : prev
      );

      return atmStrike;
    } catch (error) {
      if (error instanceof UpstoxMarketDataError) {
        throw error;
      }
      throw new UpstoxMarketDataError(
        `Error calculating ATM strike: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get option chain for strikes around ATM
   * @param underlyingSymbol - Underlying symbol
   * @param expiryDate - Expiry date
   * @param strikeCount - Number of strikes above and below ATM (default: 10)
   */
  async getATMOptionChain(
    underlyingSymbol: string,
    expiryDate: string,
    strikeCount = 10
  ): Promise<OptionChainRow[]> {
    try {
      const atmStrike = await this.getATMStrike(underlyingSymbol, expiryDate);

      // Get all strikes
      const strikes = await this.instrumentService.getStrikePrices(
        underlyingSymbol,
        expiryDate
      );

      // Find strikes around ATM
      const atmIndex = strikes.findIndex((s) => s === atmStrike);
      const startIndex = Math.max(0, atmIndex - strikeCount);
      const endIndex = Math.min(strikes.length - 1, atmIndex + strikeCount);

      const strikeRange = {
        min: strikes[startIndex],
        max: strikes[endIndex],
      };

      return this.buildOptionChain({
        underlyingSymbol,
        expiryDate,
        strikeRange,
      });
    } catch (error) {
      if (error instanceof UpstoxMarketDataError) {
        throw error;
      }
      throw new UpstoxMarketDataError(
        `Error building ATM option chain: ${(error as Error).message}`
      );
    }
  }

  /**
   * Calculate Put-Call Ratio (PCR) for an expiry
   * @param underlyingSymbol - Underlying symbol
   * @param expiryDate - Expiry date
   */
  async calculatePCR(
    underlyingSymbol: string,
    expiryDate: string
  ): Promise<{
    volumePCR: number;
    oiPCR: number;
    totalCallOI: number;
    totalPutOI: number;
    totalCallVolume: number;
    totalPutVolume: number;
  }> {
    try {
      const chain = await this.buildOptionChain({
        underlyingSymbol,
        expiryDate,
      });

      let totalCallOI = 0;
      let totalPutOI = 0;
      let totalCallVolume = 0;
      let totalPutVolume = 0;

      chain.forEach((row) => {
        totalCallOI += row.call.openInterest;
        totalPutOI += row.put.openInterest;
        totalCallVolume += row.call.volume;
        totalPutVolume += row.put.volume;
      });

      return {
        volumePCR: totalCallVolume !== 0 ? totalPutVolume / totalCallVolume : 0,
        oiPCR: totalCallOI !== 0 ? totalPutOI / totalCallOI : 0,
        totalCallOI,
        totalPutOI,
        totalCallVolume,
        totalPutVolume,
      };
    } catch (error) {
      if (error instanceof UpstoxMarketDataError) {
        throw error;
      }
      throw new UpstoxMarketDataError(
        `Error calculating PCR: ${(error as Error).message}`
      );
    }
  }

  /**
   * Find max pain strike (strike with maximum open interest)
   * @param underlyingSymbol - Underlying symbol
   * @param expiryDate - Expiry date
   */
  async getMaxPainStrike(
    underlyingSymbol: string,
    expiryDate: string
  ): Promise<{ maxPainStrike: number; totalPain: number }> {
    try {
      const chain = await this.buildOptionChain({
        underlyingSymbol,
        expiryDate,
      });

      let maxPainStrike = 0;
      let minTotalPain = Infinity;

      // Calculate pain at each strike
      chain.forEach((potentialStrike) => {
        let totalPain = 0;

        chain.forEach((row) => {
          // Calculate pain for call writers
          if (row.strikePrice < potentialStrike.strikePrice) {
            totalPain += (potentialStrike.strikePrice - row.strikePrice) * row.call.openInterest;
          }

          // Calculate pain for put writers
          if (row.strikePrice > potentialStrike.strikePrice) {
            totalPain += (row.strikePrice - potentialStrike.strikePrice) * row.put.openInterest;
          }
        });

        if (totalPain < minTotalPain) {
          minTotalPain = totalPain;
          maxPainStrike = potentialStrike.strikePrice;
        }
      });

      return {
        maxPainStrike,
        totalPain: minTotalPain,
      };
    } catch (error) {
      if (error instanceof UpstoxMarketDataError) {
        throw error;
      }
      throw new UpstoxMarketDataError(
        `Error calculating max pain: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get implied volatility surface data
   * @param underlyingSymbol - Underlying symbol
   * @param expiryDate - Expiry date
   */
  async getIVSurface(
    underlyingSymbol: string,
    expiryDate: string
  ): Promise<Array<{ strike: number; callIV: number; putIV: number }>> {
    try {
      const chain = await this.buildOptionChain({
        underlyingSymbol,
        expiryDate,
      });

      return chain.map((row) => ({
        strike: row.strikePrice,
        callIV: row.call.impliedVolatility,
        putIV: row.put.impliedVolatility,
      }));
    } catch (error) {
      if (error instanceof UpstoxMarketDataError) {
        throw error;
      }
      throw new UpstoxMarketDataError(
        `Error fetching IV surface: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get option chain summary statistics
   * @param underlyingSymbol - Underlying symbol
   * @param expiryDate - Expiry date
   */
  async getChainSummary(underlyingSymbol: string, expiryDate: string): Promise<{
    totalCallOI: number;
    totalPutOI: number;
    totalCallVolume: number;
    totalPutVolume: number;
    pcr: number;
    maxPainStrike: number;
    atmStrike: number;
    avgCallIV: number;
    avgPutIV: number;
  }> {
    try {
      const [chain, atmStrike, maxPain] = await Promise.all([
        this.buildOptionChain({ underlyingSymbol, expiryDate }),
        this.getATMStrike(underlyingSymbol, expiryDate),
        this.getMaxPainStrike(underlyingSymbol, expiryDate),
      ]);

      let totalCallOI = 0;
      let totalPutOI = 0;
      let totalCallVolume = 0;
      let totalPutVolume = 0;
      let totalCallIV = 0;
      let totalPutIV = 0;

      chain.forEach((row) => {
        totalCallOI += row.call.openInterest;
        totalPutOI += row.put.openInterest;
        totalCallVolume += row.call.volume;
        totalPutVolume += row.put.volume;
        totalCallIV += row.call.impliedVolatility;
        totalPutIV += row.put.impliedVolatility;
      });

      return {
        totalCallOI,
        totalPutOI,
        totalCallVolume,
        totalPutVolume,
        pcr: totalCallOI !== 0 ? totalPutOI / totalCallOI : 0,
        maxPainStrike: maxPain.maxPainStrike,
        atmStrike,
        avgCallIV: chain.length > 0 ? totalCallIV / chain.length : 0,
        avgPutIV: chain.length > 0 ? totalPutIV / chain.length : 0,
      };
    } catch (error) {
      if (error instanceof UpstoxMarketDataError) {
        throw error;
      }
      throw new UpstoxMarketDataError(
        `Error calculating chain summary: ${(error as Error).message}`
      );
    }
  }
}
