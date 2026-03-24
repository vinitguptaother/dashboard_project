// services/upstoxSymbols.js
// Lightweight symbol → Upstox instrument key mapping utilities

// NOTE:
// - Keys below are seeded with examples and placeholders for indices.
// - Update the placeholders with your actual instrument keys when available.
// - Mapping is case-insensitive and trims whitespace.

const SYMBOL_TO_INSTRUMENT = {
  // Equities (examples)
  'RELIANCE': 'NSE_EQ|INE002A01018',
  'INFOSYS': 'NSE_EQ|INE009A01021',
  'HINDUNILVR': 'NSE_EQ|INE030A01027',

  // Common alternate tickers → same instrument
  'INFY': 'NSE_EQ|INE009A01021',

  // Indices (PLACEHOLDERS — replace with real instrument keys you use)
  'NIFTY': 'NSE_INDEX|NIFTY_50_PLACEHOLDER',
  'NIFTY 50': 'NSE_INDEX|NIFTY_50_PLACEHOLDER',
  'SENSEX': 'BSE_INDEX|SENSEX_PLACEHOLDER',
  'BANKNIFTY': 'NSE_INDEX|BANKNIFTY_PLACEHOLDER'
};

function normalizeSymbol(symbol) {
  return String(symbol || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

/**
 * Get the Upstox instrument key for a given human-friendly symbol.
 * If unknown, returns the input value unchanged so callers can still attempt a fetch.
 * @param {string} symbol
 * @returns {string}
 */
function getInstrumentKeyForSymbol(symbol) {
  const norm = normalizeSymbol(symbol);
  return SYMBOL_TO_INSTRUMENT[norm] || symbol;
}

/**
 * Convert an array of symbols to instrument keys. Unknowns are returned unchanged.
 * @param {string[]} symbols
 * @returns {string[]}
 */
function getInstrumentKeysForSymbols(symbols) {
  if (!Array.isArray(symbols)) return [];
  return symbols.map((s) => getInstrumentKeyForSymbol(s));
}

module.exports = {
  getInstrumentKeyForSymbol,
  getInstrumentKeysForSymbols
};


