// Default watchlist with popular Indian stocks
// Using placeholder instrument keys for now - will be replaced with real Upstox keys later

export const DEFAULT_WATCHLIST = [
  'RELIANCE',
  'INFOSYS',
  'HINDUNILVR',
  'TCS',
  'HDFC',
  'ICICIBANK',
  'SBIN',
  'ITC',
  'LT',
  'AXISBANK'
];

// Mapping of symbols to instrument keys (placeholders for now)
export const SYMBOL_TO_INSTRUMENT_MAP: Record<string, string> = {
  'RELIANCE': 'NSE_EQ|INE002A01018',
  'TCS': 'NSE_EQ|INE467B01029', 
  'HDFCBANK': 'NSE_EQ|INE040A01034',
  'INFY': 'NSE_EQ|INE009A01021',
  'INFOSYS': 'NSE_EQ|INE009A01021', // Same as INFY
  'HDFC': 'NSE_EQ|INE001A01036', // HDFC Limited
  'ICICIBANK': 'NSE_EQ|INE090A01021',
  'HINDUNILVR': 'NSE_EQ|INE030A01027',
  'ITC': 'NSE_EQ|INE154A01025',
  'SBIN': 'NSE_EQ|INE062A01020',
  'BAJFINANCE': 'NSE_EQ|INE296A01024',
  'LT': 'NSE_EQ|INE018A01030',
  'KOTAKBANK': 'NSE_EQ|INE237A01028',
  'AXISBANK': 'NSE_EQ|INE238A01034',
  'ASIANPAINT': 'NSE_EQ|INE021A01026',
  'MARUTI': 'NSE_EQ|INE585B01010',
  'WIPRO': 'NSE_EQ|INE075A01022',
  'ULTRACEMCO': 'NSE_EQ|INE481G01011',
  'NESTLEIND': 'NSE_EQ|INE239A01016',
  'POWERGRID': 'NSE_EQ|INE752E01010',
  'TATASTEEL': 'NSE_EQ|INE081A01020',
  'HCLTECH': 'NSE_EQ|INE860A01027'
};

// Market indices with placeholder keys
export const MARKET_INDICES = {
  'NIFTY': 'NSE_INDEX|Nifty 50',
  'SENSEX': 'BSE_INDEX|SENSEX',
  'BANKNIFTY': 'NSE_INDEX|Nifty Bank'
};

// Sector classifications for heat map coloring
export const SECTOR_MAP: Record<string, string> = {
  'RELIANCE': 'Energy',
  'TCS': 'IT',
  'HDFCBANK': 'Banking',
  'INFY': 'IT',
  'INFOSYS': 'IT',
  'HDFC': 'Financial',
  'ICICIBANK': 'Banking',
  'HINDUNILVR': 'FMCG',
  'ITC': 'FMCG',
  'SBIN': 'Banking',
  'BAJFINANCE': 'Financial',
  'LT': 'Infrastructure',
  'KOTAKBANK': 'Banking',
  'AXISBANK': 'Banking',
  'ASIANPAINT': 'Paint',
  'MARUTI': 'Auto',
  'WIPRO': 'IT',
  'ULTRACEMCO': 'Cement',
  'NESTLEIND': 'FMCG',
  'POWERGRID': 'Power',
  'TATASTEEL': 'Steel',
  'HCLTECH': 'IT'
};