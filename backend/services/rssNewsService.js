// backend/services/rssNewsService.js
// Fetches REAL-TIME Indian financial news from RSS feeds — no API key needed.
// Sources: Economic Times, Business Standard, Moneycontrol, LiveMint
// This is the fix for stale NewsAPI data (free tier has 24h delay).

const Parser = require('rss-parser');

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (compatible; StockBot/1.0)',
    'Accept': 'application/rss+xml, application/xml, text/xml',
  },
  customFields: {
    item: [['media:content', 'mediaContent'], ['content:encoded', 'contentEncoded']],
  },
});

// ─── RSS Feed Sources ─────────────────────────────────────────────────────────
const RSS_FEEDS = [
  {
    url:      'https://economictimes.indiatimes.com/markets/rss.cms',
    source:   'Economic Times',
    category: 'market-news',
  },
  {
    url:      'https://economictimes.indiatimes.com/markets/stocks/news/rssfeeds/2146842.cms',
    source:   'Economic Times',
    category: 'market-news',
  },
  {
    url:      'https://www.business-standard.com/rss/markets-106.rss',
    source:   'Business Standard',
    category: 'market-news',
  },
  {
    url:      'https://www.business-standard.com/rss/economy-policy-101.rss',
    source:   'Business Standard',
    category: 'monetary-policy',
  },
  {
    url:      'https://www.moneycontrol.com/rss/latestnews.xml',
    source:   'Moneycontrol',
    category: 'market-news',
  },
  {
    url:      'https://www.livemint.com/rss/markets',
    source:   'LiveMint',
    category: 'market-news',
  },
];

// ─── NSE Stock Symbols to Extract from Article Text ──────────────────────────
// Top 80 NSE stocks by market cap — used to tag articles with relevant stocks
const NSE_SYMBOLS = [
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'BHARTIARTL',
  'ITC', 'KOTAKBANK', 'LT', 'BAJFINANCE', 'SBIN', 'WIPRO', 'ULTRACEMCO', 'ADANIENT',
  'ONGC', 'NTPC', 'POWERGRID', 'SUNPHARMA', 'MARUTI', 'TATAMOTORS', 'TATASTEEL',
  'AXISBANK', 'TECHM', 'HCLTECH', 'INDUSINDBK', 'NESTLEIND', 'GRASIM', 'BPCL',
  'EICHERMOT', 'DRREDDY', 'BAJAJFINSV', 'ADANIPORTS', 'CIPLA', 'TITAN', 'HEROMOTOCO',
  'DIVISLAB', 'HINDALCO', 'JSWSTEEL', 'COALINDIA', 'UPL', 'BRITANNIA', 'SHREECEM',
  'SBILIFE', 'HDFCLIFE', 'APOLLOHOSP', 'DMART', 'PIDILITIND', 'SIEMENS', 'HAL',
  'SAIL', 'BANKBARODA', 'CANBK', 'PNB', 'FEDERALBNK', 'IDFCFIRSTB', 'RBLBANK',
  'ZOMATO', 'PAYTM', 'NYKAA', 'POLICYBZR', 'IRCTC', 'TATAPOWER', 'TRENT',
  'MUTHOOTFIN', 'CHOLAFIN', 'LICHSGFIN', 'GODREJCP', 'DABUR', 'EMAMILTD',
  'COLPAL', 'MARICO', 'TATACONSUM', 'VEDL', 'NATIONALUM', 'NMDC',
  'AARTIIND', 'DEEPAKNTR', 'PIIND', 'ASTRAL', 'POLYCAB',
];

// Also recognise company names in articles
const COMPANY_NAME_MAP = {
  'Reliance Industries':  'RELIANCE',
  'Tata Consultancy':     'TCS',
  'HDFC Bank':            'HDFCBANK',
  'Infosys':              'INFY',
  'ICICI Bank':           'ICICIBANK',
  'State Bank':           'SBIN',
  'Wipro':                'WIPRO',
  'Tata Motors':          'TATAMOTORS',
  'Tata Steel':           'TATASTEEL',
  'Sun Pharma':           'SUNPHARMA',
  'Maruti':               'MARUTI',
  'Bajaj Finance':        'BAJFINANCE',
  'HCL Technologies':     'HCLTECH',
  'Axis Bank':            'AXISBANK',
  'Kotak Mahindra':       'KOTAKBANK',
  'Adani Enterprises':    'ADANIENT',
  'Adani Ports':          'ADANIPORTS',
  'Bharti Airtel':        'BHARTIARTL',
};

// ─── Sentiment Analysis ───────────────────────────────────────────────────────
const POSITIVE_WORDS = [
  'gain', 'rise', 'surge', 'rally', 'bullish', 'growth', 'profit', 'strong',
  'beat', 'upgrade', 'buy', 'positive', 'higher', 'jump', 'boost', 'recover',
  'outperform', 'record', 'breakout', 'upside', 'momentum', 'expansion',
];
const NEGATIVE_WORDS = [
  'fall', 'drop', 'decline', 'bearish', 'loss', 'weak', 'miss', 'downgrade',
  'sell', 'negative', 'lower', 'crash', 'plunge', 'concern', 'risk', 'cut',
  'underperform', 'slowdown', 'recession', 'default', 'warning', 'pressure',
];

function scoreSentiment(text) {
  const lower = text.toLowerCase();
  const pos = POSITIVE_WORDS.filter(w => lower.includes(w)).length;
  const neg = NEGATIVE_WORDS.filter(w => lower.includes(w)).length;
  if (pos > neg + 1) return 'positive';
  if (neg > pos + 1) return 'negative';
  return 'neutral';
}

// ─── Stock Symbol Extraction ──────────────────────────────────────────────────
function extractStockSymbols(text) {
  const found = new Set();
  const upper = text.toUpperCase();

  // Direct symbol match
  for (const sym of NSE_SYMBOLS) {
    if (upper.includes(sym)) found.add(sym);
  }

  // Company name match
  for (const [name, sym] of Object.entries(COMPANY_NAME_MAP)) {
    if (text.includes(name)) found.add(sym);
  }

  return [...found].slice(0, 5); // max 5 stocks per article
}

// ─── Clean HTML from RSS content ─────────────────────────────────────────────
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);
}

// ─── Fetch All RSS Feeds ──────────────────────────────────────────────────────
async function fetchRSSNews() {
  const articles = [];
  const seenTitles = new Set(); // dedup by title

  for (const feed of RSS_FEEDS) {
    try {
      const result = await parser.parseURL(feed.url);
      const items = (result.items || []).slice(0, 12); // max 12 per feed

      for (const item of items) {
        const title = (item.title || '').trim();
        if (!title || seenTitles.has(title.toLowerCase())) continue;
        seenTitles.add(title.toLowerCase());

        const rawContent = item.contentEncoded || item.content || item.summary || '';
        const summary = item.contentSnippet || stripHtml(rawContent) || title;
        const fullText = `${title} ${summary}`;

        articles.push({
          title,
          summary: summary.slice(0, 400),
          url:            item.link || '',
          source:         feed.source,
          category:       feed.category,
          sentiment:      scoreSentiment(fullText),
          relevantStocks: extractStockSymbols(fullText),
          publishedAt:    item.pubDate ? new Date(item.pubDate) : new Date(),
          tags:           [],
        });
      }
    } catch (err) {
      // Log but don't crash — one feed failing shouldn't stop others
      console.warn(`⚠️  RSS fetch failed [${feed.source}]: ${err.message}`);
    }
  }

  // Sort by newest first
  articles.sort((a, b) => b.publishedAt - a.publishedAt);

  console.log(`📰 RSS: fetched ${articles.length} live articles`);
  return articles;
}

module.exports = { fetchRSSNews };
