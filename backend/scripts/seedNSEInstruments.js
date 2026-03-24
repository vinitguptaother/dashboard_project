// backend/scripts/seedNSEInstruments.js
// Seeds the Instruments collection with NIFTY 200 stocks + popular midcaps.
// These stocks have verified ISINs — so Upstox LTP works immediately.
// Yahoo Finance autocomplete handles all other stocks dynamically via search.
//
// Run: node backend/scripts/seedNSEInstruments.js
// Or called automatically on first boot (when instruments count < 50)

const path = require('path');
if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
}

const mongoose = require('mongoose');
const Instrument = require('../models/Instrument');

// ─── NIFTY 50 + NIFTY Next 50 + Popular Midcaps ──────────────────────────────
// Format: [SYMBOL, COMPANY_NAME, ISIN]
// instrument_key is built as: NSE_EQ|ISIN
const NSE_INSTRUMENTS = [
  // ── NIFTY 50 ──────────────────────────────────────────────────────────────
  ['RELIANCE',    'Reliance Industries Ltd',              'INE002A01018'],
  ['TCS',         'Tata Consultancy Services Ltd',        'INE467B01029'],
  ['HDFCBANK',    'HDFC Bank Ltd',                        'INE040A01034'],
  ['INFY',        'Infosys Ltd',                          'INE009A01021'],
  ['ICICIBANK',   'ICICI Bank Ltd',                       'INE090A01021'],
  ['HINDUNILVR',  'Hindustan Unilever Ltd',               'INE030A01027'],
  ['BHARTIARTL',  'Bharti Airtel Ltd',                    'INE397D01024'],
  ['ITC',         'ITC Ltd',                              'INE154A01025'],
  ['KOTAKBANK',   'Kotak Mahindra Bank Ltd',              'INE237A01028'],
  ['LT',          'Larsen & Toubro Ltd',                  'INE018A01030'],
  ['BAJFINANCE',  'Bajaj Finance Ltd',                    'INE296A01024'],
  ['SBIN',        'State Bank of India',                  'INE062A01020'],
  ['WIPRO',       'Wipro Ltd',                            'INE075A01022'],
  ['ULTRACEMCO',  'UltraTech Cement Ltd',                 'INE481G01011'],
  ['ADANIENT',    'Adani Enterprises Ltd',                'INE423A01024'],
  ['ONGC',        'Oil & Natural Gas Corp Ltd',           'INE213A01029'],
  ['NTPC',        'NTPC Ltd',                             'INE733E01010'],
  ['POWERGRID',   'Power Grid Corp of India Ltd',         'INE752E01010'],
  ['SUNPHARMA',   'Sun Pharmaceutical Industries Ltd',    'INE044A01036'],
  ['MARUTI',      'Maruti Suzuki India Ltd',              'INE585B01010'],
  ['TATAMOTORS',  'Tata Motors Ltd',                      'INE155A01022'],
  ['TATASTEEL',   'Tata Steel Ltd',                       'INE081A01020'],
  ['AXISBANK',    'Axis Bank Ltd',                        'INE238A01034'],
  ['TECHM',       'Tech Mahindra Ltd',                    'INE669C01036'],
  ['HCLTECH',     'HCL Technologies Ltd',                 'INE860A01027'],
  ['INDUSINDBK',  'IndusInd Bank Ltd',                    'INE095A01012'],
  ['NESTLEIND',   'Nestle India Ltd',                     'INE239A01016'],
  ['GRASIM',      'Grasim Industries Ltd',                'INE047A01021'],
  ['BPCL',        'Bharat Petroleum Corp Ltd',            'INE029A01011'],
  ['EICHERMOT',   'Eicher Motors Ltd',                    'INE066A01021'],
  ['DRREDDY',     'Dr. Reddy\'s Laboratories Ltd',        'INE089A01023'],
  ['BAJAJFINSV',  'Bajaj Finserv Ltd',                    'INE918I01026'],
  ['ADANIPORTS',  'Adani Ports & Special Economic Zone',  'INE742F01042'],
  ['CIPLA',       'Cipla Ltd',                            'INE059A01026'],
  ['TITAN',       'Titan Company Ltd',                    'INE280A01028'],
  ['HEROMOTOCO',  'Hero MotoCorp Ltd',                    'INE158A01026'],
  ['DIVISLAB',    'Divi\'s Laboratories Ltd',             'INE361B01024'],
  ['HINDALCO',    'Hindalco Industries Ltd',              'INE038A01020'],
  ['JSWSTEEL',    'JSW Steel Ltd',                        'INE019A01038'],
  ['COALINDIA',   'Coal India Ltd',                       'INE522F01014'],
  ['BRITANNIA',   'Britannia Industries Ltd',             'INE216A01030'],
  ['SHREECEM',    'Shree Cement Ltd',                     'INE070A01015'],
  ['SBILIFE',     'SBI Life Insurance Company Ltd',       'INE330C01028'],
  ['HDFCLIFE',    'HDFC Life Insurance Company Ltd',      'INE795G01014'],
  ['APOLLOHOSP',  'Apollo Hospitals Enterprise Ltd',      'INE437A01024'],
  ['DMART',       'Avenue Supermarts Ltd',                'INE192R01011'],
  ['BAJAJ-AUTO',  'Bajaj Auto Ltd',                       'INE917I01010'],
  ['UPL',         'UPL Ltd',                              'INE628A01036'],
  ['TATACONSUM',  'Tata Consumer Products Ltd',           'INE192A01025'],
  ['ASIANPAINT',  'Asian Paints Ltd',                     'INE021A01026'],

  // ── NIFTY Next 50 ─────────────────────────────────────────────────────────
  ['SIEMENS',     'Siemens Ltd',                          'INE003A01024'],
  ['HAL',         'Hindustan Aeronautics Ltd',            'INE066F01020'],
  ['VEDL',        'Vedanta Ltd',                          'INE205A01025'],
  ['PIDILITIND',  'Pidilite Industries Ltd',              'INE318A01026'],
  ['BANKBARODA',  'Bank of Baroda',                       'INE028A01039'],
  ['CANBK',       'Canara Bank',                          'INE476A01014'],
  ['PNB',         'Punjab National Bank',                 'INE160A01022'],
  ['FEDERALBNK',  'Federal Bank Ltd',                     'INE171A01029'],
  ['IDFCFIRSTB',  'IDFC First Bank Ltd',                  'INE092T01019'],
  ['RBLBANK',     'RBL Bank Ltd',                         'INE976G01028'],
  ['ZOMATO',      'Zomato Ltd',                           'INE758T01015'],
  ['IRCTC',       'Indian Railway Catering & Tourism',    'INE335Y01020'],
  ['TATAPOWER',   'Tata Power Company Ltd',               'INE245A01021'],
  ['TRENT',       'Trent Ltd',                            'INE849A01020'],
  ['MUTHOOTFIN',  'Muthoot Finance Ltd',                  'INE414G01012'],
  ['CHOLAFIN',    'Cholamandalam Investment & Finance',   'INE121A01024'],
  ['LICHSGFIN',   'LIC Housing Finance Ltd',              'INE115A01026'],
  ['SAIL',        'Steel Authority of India Ltd',         'INE114A01011'],
  ['NMDC',        'NMDC Ltd',                             'INE584A01023'],
  ['NATIONALUM',  'National Aluminium Company Ltd',       'INE139A01034'],
  ['MARICO',      'Marico Ltd',                           'INE196A01026'],
  ['DABUR',       'Dabur India Ltd',                      'INE016A01026'],
  ['GODREJCP',    'Godrej Consumer Products Ltd',         'INE102D01028'],
  ['COLPAL',      'Colgate-Palmolive (India) Ltd',        'INE259A01022'],
  ['EMAMILTD',    'Emami Ltd',                            'INE548C01032'],
  ['JSWENERGY',   'JSW Energy Ltd',                       'INE121E01018'],
  ['ADANIGREEN',  'Adani Green Energy Ltd',               'INE364U01010'],
  ['ADANITRANS',  'Adani Transmission Ltd',               'INE931S01010'],
  ['HDFCAMC',     'HDFC Asset Management Company Ltd',    'INE127D01025'],
  ['BAJAJHLDNG',  'Bajaj Holdings & Investment Ltd',      'INE118A01012'],
  ['BERGEPAINT',  'Berger Paints India Ltd',              'INE463A01038'],
  ['GODREJPROP',  'Godrej Properties Ltd',                'INE484J01027'],
  ['DLF',         'DLF Ltd',                              'INE271C01023'],
  ['OBEROIRLTY',  'Oberoi Realty Ltd',                    'INE093I01010'],
  ['PAGEIND',     'Page Industries Ltd',                  'INE761H01022'],
  ['TORNTPHARM',  'Torrent Pharmaceuticals Ltd',          'INE685A01028'],
  ['BIOCON',      'Biocon Ltd',                           'INE376G01013'],
  ['GLENMARK',    'Glenmark Pharmaceuticals Ltd',         'INE935A01035'],
  ['LUPIN',       'Lupin Ltd',                            'INE326A01037'],
  ['AUROPHARMA',  'Aurobindo Pharma Ltd',                 'INE406A01037'],
  ['ALKEM',       'Alkem Laboratories Ltd',               'INE540L01014'],
  ['IPCALAB',     'IPCA Laboratories Ltd',                'INE571A01020'],
  ['ABBOTINDIA',  'Abbott India Ltd',                     'INE358A01014'],
  ['PFIZER',      'Pfizer Ltd',                           'INE182A01018'],
  ['GLAXO',       'GlaxoSmithKline Pharma Ltd',           'INE159A01016'],
  ['NAUKRI',      'Info Edge (India) Ltd',                'INE663F01024'],
  ['JUSTDIAL',    'Just Dial Ltd',                        'INE599M01018'],
  ['INDIAMART',   'IndiaMART InterMESH Ltd',              'INE569J01011'],
  ['PERSISTENT',  'Persistent Systems Ltd',               'INE262H01021'],
  ['COFORGE',     'Coforge Ltd',                          'INE591G01017'],
  ['MPHASIS',     'Mphasis Ltd',                          'INE356A01018'],
  ['LTTS',        'L&T Technology Services Ltd',          'INE010V01017'],
  ['TATAELXSI',   'Tata Elxsi Ltd',                       'INE670A01012'],
  ['KPITTECH',    'KPIT Technologies Ltd',                'INE04I401011'],
  ['CYIENT',      'Cyient Ltd',                           'INE136B01020'],

  // ── Popular Midcaps & Smallcaps ───────────────────────────────────────────
  ['POLYCAB',     'Polycab India Ltd',                    'INE455K01017'],
  ['ASTRAL',      'Astral Ltd',                           'INE006I01046'],
  ['PIIND',       'PI Industries Ltd',                    'INE603J01030'],
  ['DEEPAKNTR',   'Deepak Nitrite Ltd',                   'INE288B01029'],
  ['AARTIIND',    'Aarti Industries Ltd',                 'INE769A01020'],
  ['TANLA',       'Tanla Platforms Ltd',                  'INE483C01032'],
  ['DIXON',       'Dixon Technologies Ltd',               'INE935N01020'],
  ['CROMPTON',    'Crompton Greaves Consumer Electrical',  'INE260J01028'],
  ['HAVELLS',     'Havells India Ltd',                    'INE176B01034'],
  ['VGUARD',      'V-Guard Industries Ltd',               'INE951I01027'],
  ['RAJESHEXPO',  'Rajesh Exports Ltd',                   'INE343B01030'],
  ['KALYANKJIL',  'Kalyan Jewellers India Ltd',           'INE303R01014'],
  ['ABFRL',       'Aditya Birla Fashion & Retail Ltd',    'INE647O01011'],
  ['DELHIVERY',   'Delhivery Ltd',                        'INE008D01020'],
  ['ZYDUSLIFE',   'Zydus Lifesciences Ltd',               'INE010B01027'],
  ['LAURUSLABS',  'Laurus Labs Ltd',                      'INE947Q01010'],
  ['SYNGENE',     'Syngene International Ltd',            'INE398R01022'],
  ['METROPOLIS',  'Metropolis Healthcare Ltd',            'INE112L01020'],
  ['DRLAL',       'Dr. Lal Pathlabs Ltd',                 'INE093R01011'],
  ['TTKPRESTIG',  'TTK Prestige Ltd',                     'INE690A01010'],
  ['RELAXO',      'Relaxo Footwears Ltd',                 'INE131B01039'],
  ['BATA',        'Bata India Ltd',                       'INE176A01028'],
  ['CAMPUS',      'Campus Activewear Ltd',                'INE0JW201016'],
  ['CAMS',        'Computer Age Management Services',     'INE596I01012'],
  ['CDSL',        'Central Depository Services India',    'INE736A01011'],
  ['BSE',         'BSE Ltd',                              'INE118H01025'],
  ['MCX',         'Multi Commodity Exchange of India',    'INE745G01035'],
  ['IEX',         'Indian Energy Exchange Ltd',           'INE022Q01020'],
  ['CRISIL',      'CRISIL Ltd',                           'INE007B01023'],
  ['ICRA',        'ICRA Ltd',                             'INE725G01011'],
  ['CONCOR',      'Container Corp of India Ltd',          'INE111A01025'],
  ['BLUEDART',    'Blue Dart Express Ltd',                'INE233B01017'],
  ['GATI',        'Gati Ltd',                             'INE02DS01014'],
  ['MAHINDCIE',   'Mahindra CIE Automotive Ltd',          'INE536H01010'],
  ['MOTHERSON',   'Samvardhana Motherson International',  'INE775A01035'],
  ['BHARATFORG',  'Bharat Forge Ltd',                     'INE465A01025'],
  ['SUNDRMFAST',  'Sundram Fasteners Ltd',                'INE387A01021'],
  ['SCHAEFFLER',  'Schaeffler India Ltd',                 'INE513A01014'],
  ['CUMMINSIND',  'Cummins India Ltd',                    'INE298A01020'],
  ['THERMAX',     'Thermax Ltd',                          'INE152A01029'],
  ['KSB',         'KSB Ltd',                              'INE999A01015'],
  ['APLAPOLLO',   'APL Apollo Tubes Ltd',                 'INE702C01027'],
  ['JINDALSAW',   'Jindal Saw Ltd',                       'INE324A01024'],
  ['WELSPUNIND',  'Welspun India Ltd',                    'INE192B01031'],
  ['NIACL',       'New India Assurance Co Ltd',           'INE470Y01017'],
  ['GICRE',       'General Insurance Corp of India',      'INE481Y01014'],
  ['STARHEALTH',  'Star Health and Allied Insurance',     'INE246W01020'],
  ['MAXHEALTH',   'Max Healthcare Institute Ltd',         'INE027H01010'],
  ['FORTIS',      'Fortis Healthcare Ltd',                'INE061F01013'],
  ['NARAYANA',    'Narayana Hrudayalaya Ltd',             'INE410P01011'],
  ['ASTER',       'Aster DM Healthcare Ltd',              'INE914M01019'],
  ['RAINBOW',     'Rainbow Childrens Medicare Ltd',       'INE918Z01012'],
];

// ─── Seed Function ────────────────────────────────────────────────────────────
async function seedNSEInstruments(connectDB = true) {
  if (connectDB) {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');
  }

  const ops = NSE_INSTRUMENTS.map(([symbol, name, isin]) => ({
    updateOne: {
      filter: { isin, exchange: 'NSE' },
      update: {
        $set: {
          symbol,
          name,
          exchange: 'NSE',
          token:    `NSE_EQ|${isin}`,
          segment:  'NSE_EQ',
          isin,
          updatedAt: new Date(),
        },
      },
      upsert: true,
    },
  }));

  await Instrument.bulkWrite(ops, { ordered: false });
  const count = await Instrument.countDocuments({ exchange: 'NSE' });
  console.log(`✅ NSE seed complete: ${NSE_INSTRUMENTS.length} stocks seeded | Total in DB: ${count}`);

  if (connectDB) {
    await mongoose.disconnect();
    console.log('✅ Disconnected');
  }

  return NSE_INSTRUMENTS.length;
}

if (require.main === module) {
  seedNSEInstruments()
    .then(() => process.exit(0))
    .catch(err => { console.error('❌ Seed failed:', err); process.exit(1); });
}

module.exports = { seedNSEInstruments };
