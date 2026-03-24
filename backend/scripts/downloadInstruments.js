// backend/scripts/downloadInstruments.js
// Downloads ALL NSE + BSE equity instruments from Upstox public CSV (no auth needed)
// and upserts them into MongoDB Instrument collection.
//
// Run standalone:  node backend/scripts/downloadInstruments.js
// Or call from server.js on startup if DB is empty.

const https = require('https');
const zlib = require('zlib');
const path = require('path');

// Load .env only when run as standalone script
if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
}

const mongoose = require('mongoose');
const Instrument = require('../models/Instrument');

// Upstox public instrument CSV URLs — no authentication needed
const INSTRUMENT_URLS = {
  NSE: 'https://assets.upstox.com/market-quote/instruments/exchange/NSE.csv.gz',
  BSE: 'https://assets.upstox.com/market-quote/instruments/exchange/BSE.csv.gz',
};

// ─── CSV Parser ───────────────────────────────────────────────────────────────
// Handles quoted fields with embedded commas correctly
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// ─── Download + Decompress + Parse ───────────────────────────────────────────
function downloadInstrumentsCSV(url, exchange) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 60000 }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} downloading from ${url}`));
        return;
      }

      const gunzip = zlib.createGunzip();
      const chunks = [];

      res.pipe(gunzip);
      gunzip.on('data', (chunk) => chunks.push(chunk));
      gunzip.on('end', () => {
        try {
          const csv = Buffer.concat(chunks).toString('utf8');
          const lines = csv.split('\n');
          if (!lines[0]) return resolve([]);

          // Parse header row
          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
          const instruments = [];

          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const vals = parseCSVLine(line);
            if (vals.length < 4) continue;

            const row = {};
            headers.forEach((h, idx) => { row[h] = (vals[idx] || '').replace(/"/g, ''); });

            // Only import equity instruments — skip F&O, ETFs, indices
            if (row.instrument_type !== 'EQ') continue;
            if (!row.tradingsymbol || !row.instrument_key) continue;

            // Extract ISIN from instrument_key (format: NSE_EQ|INE002A01018)
            const keyParts = row.instrument_key.split('|');
            const isin = keyParts.length === 2 ? keyParts[1] : '';

            instruments.push({
              symbol:   row.tradingsymbol.toUpperCase(),
              name:     row.name || row.tradingsymbol,
              exchange: exchange,
              token:    row.instrument_key,
              segment:  `${exchange}_EQ`,
              isin:     isin,
            });
          }

          resolve(instruments);
        } catch (parseErr) {
          reject(parseErr);
        }
      });
      gunzip.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Download timed out for ${url}`));
    });
  });
}

// ─── Main Import Function ─────────────────────────────────────────────────────
// connectDB: pass false when called from server.js (already connected)
async function importInstruments(connectDB = true) {
  if (connectDB) {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not set in .env');
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');
  }

  let totalImported = 0;

  for (const [exchange, url] of Object.entries(INSTRUMENT_URLS)) {
    console.log(`📥 Downloading ${exchange} instruments from Upstox...`);
    try {
      const instruments = await downloadInstrumentsCSV(url, exchange);
      console.log(`  📊 Parsed ${instruments.length} ${exchange} EQ instruments`);

      if (instruments.length === 0) {
        console.warn(`  ⚠️  No instruments found for ${exchange}, skipping`);
        continue;
      }

      // Upsert in batches of 500 to avoid MongoDB document size limits
      for (let i = 0; i < instruments.length; i += 500) {
        const batch = instruments.slice(i, i + 500);
        const ops = batch.map(inst => ({
          updateOne: {
            filter: { token: inst.token },
            update: {
              $set: {
                symbol:    inst.symbol,
                name:      inst.name,
                exchange:  inst.exchange,
                token:     inst.token,
                segment:   inst.segment,
                isin:      inst.isin,
                updatedAt: new Date(),
              },
            },
            upsert: true,
          },
        }));

        await Instrument.bulkWrite(ops, { ordered: false });
        totalImported += batch.length;
      }

      const count = await Instrument.countDocuments({ exchange });
      console.log(`  ✅ ${exchange}: ${count} total instruments in DB`);

    } catch (err) {
      console.error(`  ❌ Failed to import ${exchange}:`, err.message);
    }
  }

  console.log(`\n✅ Total instruments imported/updated: ${totalImported}`);

  if (connectDB) {
    await mongoose.disconnect();
    console.log('✅ MongoDB disconnected');
  }

  return totalImported;
}

// ─── Run standalone ───────────────────────────────────────────────────────────
if (require.main === module) {
  importInstruments()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Import failed:', err);
      process.exit(1);
    });
}

module.exports = { importInstruments };
