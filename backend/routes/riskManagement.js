// backend/routes/riskManagement.js
// What this does: Position sizing calculator + risk settings CRUD.
// Calculates exactly how many shares to buy based on your capital and risk tolerance.

const express = require('express');
const RiskSettings = require('../models/RiskSettings');

const router = express.Router();

// ─────────────────────────────────────────────
// Helper: Get or create default risk settings
// ─────────────────────────────────────────────
async function getOrCreateSettings() {
  let settings = await RiskSettings.findOne({ userId: 'default' });
  if (!settings) {
    settings = await RiskSettings.create({ userId: 'default' });
  }
  return settings;
}

// ─────────────────────────────────────────────
// GET /api/risk/settings
// Returns current risk settings
// ─────────────────────────────────────────────
router.get('/settings', async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    res.json({ status: 'success', data: settings });
  } catch (err) {
    console.error('Error fetching risk settings:', err.message);
    res.status(500).json({ status: 'error', message: 'Failed to load risk settings' });
  }
});

// ─────────────────────────────────────────────
// PUT /api/risk/settings
// Update risk settings (capital, risk%, limits)
// ─────────────────────────────────────────────
router.put('/settings', async (req, res) => {
  try {
    const { capital, riskPerTrade, maxPositionPct, dailyLossLimitPct, dailyLossLimitAmount } = req.body;

    const updates = {};
    if (capital !== undefined) {
      const cap = Number(capital);
      if (isNaN(cap) || cap < 10000) {
        return res.status(400).json({ status: 'error', message: 'Capital must be at least ₹10,000' });
      }
      updates.capital = cap;
    }
    if (riskPerTrade !== undefined) {
      const rpt = Number(riskPerTrade);
      if (isNaN(rpt) || rpt < 0.5 || rpt > 10) {
        return res.status(400).json({ status: 'error', message: 'Risk per trade must be 0.5% to 10%' });
      }
      updates.riskPerTrade = rpt;
    }
    if (maxPositionPct !== undefined) {
      const mpp = Number(maxPositionPct);
      if (isNaN(mpp) || mpp < 5 || mpp > 100) {
        return res.status(400).json({ status: 'error', message: 'Max position must be 5% to 100%' });
      }
      updates.maxPositionPct = mpp;
    }
    if (dailyLossLimitPct !== undefined) {
      const dll = Number(dailyLossLimitPct);
      if (isNaN(dll) || dll < 1 || dll > 25) {
        return res.status(400).json({ status: 'error', message: 'Daily loss limit must be 1% to 25%' });
      }
      updates.dailyLossLimitPct = dll;
    }
    if (dailyLossLimitAmount !== undefined) {
      updates.dailyLossLimitAmount = dailyLossLimitAmount === null ? null : Number(dailyLossLimitAmount);
    }

    const settings = await RiskSettings.findOneAndUpdate(
      { userId: 'default' },
      { $set: updates },
      { new: true, upsert: true }
    );

    res.json({ status: 'success', data: settings, message: 'Risk settings updated' });
  } catch (err) {
    console.error('Error updating risk settings:', err.message);
    res.status(500).json({ status: 'error', message: 'Failed to update risk settings' });
  }
});

// ─────────────────────────────────────────────
// POST /api/risk/position-size
// Calculate position size for a trade
// Body: { entryPrice, stopLoss, target, action }
// Returns: quantity, investment, riskAmount, etc.
// ─────────────────────────────────────────────
router.post('/position-size', async (req, res) => {
  try {
    const { entryPrice, stopLoss, target, action } = req.body;

    // Validate inputs
    const entry = Number(entryPrice);
    const sl = Number(stopLoss);
    const tgt = Number(target);
    const tradeAction = (action || 'BUY').toUpperCase();

    if (isNaN(entry) || entry <= 0) {
      return res.status(400).json({ status: 'error', message: 'Invalid entry price' });
    }
    if (isNaN(sl) || sl <= 0) {
      return res.status(400).json({ status: 'error', message: 'Invalid stop loss' });
    }
    if (isNaN(tgt) || tgt <= 0) {
      return res.status(400).json({ status: 'error', message: 'Invalid target price' });
    }

    // Validate SL/Target direction based on action
    if (tradeAction === 'BUY') {
      if (sl >= entry) {
        return res.status(400).json({ status: 'error', message: 'Stop loss must be below entry price for BUY' });
      }
      if (tgt <= entry) {
        return res.status(400).json({ status: 'error', message: 'Target must be above entry price for BUY' });
      }
    } else if (tradeAction === 'SELL') {
      if (sl <= entry) {
        return res.status(400).json({ status: 'error', message: 'Stop loss must be above entry price for SELL' });
      }
      if (tgt >= entry) {
        return res.status(400).json({ status: 'error', message: 'Target must be below entry price for SELL' });
      }
    }

    // Get saved risk settings
    const settings = await getOrCreateSettings();

    // Core calculation
    const maxRiskAmount = (settings.capital * settings.riskPerTrade) / 100;
    const riskPerShare = Math.abs(entry - sl);
    const rewardPerShare = Math.abs(tgt - entry);

    if (riskPerShare === 0) {
      return res.status(400).json({ status: 'error', message: 'Entry and stop loss cannot be the same' });
    }

    const rawQuantity = maxRiskAmount / riskPerShare;
    const quantity = Math.floor(rawQuantity); // Always round down — never risk more than allowed

    if (quantity === 0) {
      return res.status(200).json({
        status: 'success',
        data: {
          quantity: 0,
          investment: 0,
          riskAmount: 0,
          riskPerShare,
          rewardPerShare,
          potentialProfit: 0,
          riskRewardRatio: `1:${(rewardPerShare / riskPerShare).toFixed(1)}`,
          positionPctOfCapital: 0,
          maxRiskAmount,
          warnings: ['Risk per share (₹' + riskPerShare.toFixed(2) + ') exceeds max risk amount (₹' + maxRiskAmount.toFixed(2) + '). Cannot size this trade.'],
          settings: {
            capital: settings.capital,
            riskPerTrade: settings.riskPerTrade,
            maxPositionPct: settings.maxPositionPct,
          },
        },
      });
    }

    const investment = quantity * entry;
    const actualRiskAmount = quantity * riskPerShare;
    const potentialProfit = quantity * rewardPerShare;
    const positionPctOfCapital = (investment / settings.capital) * 100;
    const rrRatio = rewardPerShare / riskPerShare;

    // Generate warnings
    const warnings = [];
    if (positionPctOfCapital > settings.maxPositionPct) {
      // Reduce quantity to fit within max position limit
      const maxInvestment = (settings.capital * settings.maxPositionPct) / 100;
      const cappedQuantity = Math.floor(maxInvestment / entry);
      warnings.push(
        `Position (₹${investment.toLocaleString('en-IN')}) exceeds ${settings.maxPositionPct}% of capital. ` +
        `Max recommended: ${cappedQuantity} shares (₹${(cappedQuantity * entry).toLocaleString('en-IN')})`
      );
    }
    if (rrRatio < 1.5) {
      warnings.push(`Risk:Reward ratio (1:${rrRatio.toFixed(1)}) is below 1:1.5. Consider finding a better setup.`);
    }
    if (settings.killSwitchActive) {
      warnings.push('⚠️ Daily loss limit reached. Kill switch is active — no new trades recommended.');
    }

    res.json({
      status: 'success',
      data: {
        quantity,
        investment,
        riskAmount: actualRiskAmount,
        riskPerShare,
        rewardPerShare,
        potentialProfit,
        riskRewardRatio: `1:${rrRatio.toFixed(1)}`,
        positionPctOfCapital: Math.round(positionPctOfCapital * 10) / 10,
        maxRiskAmount,
        warnings,
        settings: {
          capital: settings.capital,
          riskPerTrade: settings.riskPerTrade,
          maxPositionPct: settings.maxPositionPct,
        },
      },
    });
  } catch (err) {
    console.error('Error calculating position size:', err.message);
    res.status(500).json({ status: 'error', message: 'Failed to calculate position size' });
  }
});

// ─────────────────────────────────────────────
// GET /api/risk/kill-switch
// Check current kill switch status
// ─────────────────────────────────────────────
router.get('/kill-switch', async (req, res) => {
  try {
    const settings = await getOrCreateSettings();

    // Auto-reset if kill switch date is not today (IST)
    if (settings.killSwitchActive && settings.killSwitchDate) {
      const now = new Date();
      const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const switchDate = new Date(settings.killSwitchDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

      if (istNow.toDateString() !== switchDate.toDateString()) {
        // New day — reset kill switch
        settings.killSwitchActive = false;
        settings.killSwitchDate = null;
        await settings.save();
      }
    }

    res.json({
      status: 'success',
      data: {
        active: settings.killSwitchActive,
        activatedAt: settings.killSwitchDate,
      },
    });
  } catch (err) {
    console.error('Error checking kill switch:', err.message);
    res.status(500).json({ status: 'error', message: 'Failed to check kill switch' });
  }
});

// ─────────────────────────────────────────────
// POST /api/risk/kill-switch/toggle
// Manually activate/deactivate kill switch
// ─────────────────────────────────────────────
router.post('/kill-switch/toggle', async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    settings.killSwitchActive = !settings.killSwitchActive;
    settings.killSwitchDate = settings.killSwitchActive ? new Date() : null;
    await settings.save();

    res.json({
      status: 'success',
      data: {
        active: settings.killSwitchActive,
        activatedAt: settings.killSwitchDate,
      },
      message: settings.killSwitchActive
        ? 'Kill switch activated — no new trades until tomorrow'
        : 'Kill switch deactivated — trading resumed',
    });
  } catch (err) {
    console.error('Error toggling kill switch:', err.message);
    res.status(500).json({ status: 'error', message: 'Failed to toggle kill switch' });
  }
});

// ─────────────────────────────────────────────
// Shared: Calculate today's P&L from closed trades
// Used by both the API endpoint and the trade monitor cron
// ─────────────────────────────────────────────
async function calculateDailyPnL(riskSettings) {
  const TradeSetup = require('../models/TradeSetup');

  // Get start of today in IST
  const now = new Date();
  const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const todayStart = new Date(istNow);
  todayStart.setHours(0, 0, 0, 0);
  // Convert back to UTC for DB query
  const utcTodayStart = new Date(todayStart.getTime() - (5.5 * 60 * 60 * 1000));

  // Find all trades closed today (TARGET_HIT or SL_HIT)
  const closedToday = await TradeSetup.find({
    status: { $in: ['TARGET_HIT', 'SL_HIT'] },
    $or: [
      { closedAt: { $gte: utcTodayStart } },
      // Fallback for older trades without closedAt — use updatedAt
      { closedAt: null, updatedAt: { $gte: utcTodayStart }, status: { $in: ['TARGET_HIT', 'SL_HIT'] } },
    ],
  }).lean();

  let totalPnL = 0;
  let wins = 0;
  let losses = 0;
  const trades = [];

  for (const setup of closedToday) {
    // Calculate quantity from position sizer logic
    const riskPerShare = Math.abs(setup.entryPrice - setup.stopLoss);
    if (riskPerShare === 0) continue;

    const maxRiskAmount = (riskSettings.capital * riskSettings.riskPerTrade) / 100;
    const quantity = setup.quantity || Math.floor(maxRiskAmount / riskPerShare);
    const exitPrice = setup.exitPrice || (setup.status === 'TARGET_HIT' ? setup.target : setup.stopLoss);

    let pnl = 0;
    if (setup.action === 'BUY') {
      pnl = (exitPrice - setup.entryPrice) * quantity;
    } else if (setup.action === 'SELL') {
      pnl = (setup.entryPrice - exitPrice) * quantity;
    }

    totalPnL += pnl;
    if (pnl >= 0) wins++;
    else losses++;

    trades.push({
      symbol: setup.symbol,
      action: setup.action,
      status: setup.status,
      entryPrice: setup.entryPrice,
      exitPrice,
      quantity,
      pnl,
      closedAt: setup.closedAt || setup.updatedAt,
    });
  }

  const dailyLossLimit = (riskSettings.capital * riskSettings.dailyLossLimitPct) / 100;
  const dailyLossLimitAmount = riskSettings.dailyLossLimitAmount || dailyLossLimit;
  const effectiveLimit = Math.min(dailyLossLimit, dailyLossLimitAmount);
  const usedPct = totalPnL < 0 ? (Math.abs(totalPnL) / effectiveLimit) * 100 : 0;

  return {
    totalPnL,
    wins,
    losses,
    trades,
    dailyLossLimit: effectiveLimit,
    usedPct: Math.round(usedPct * 10) / 10,
    killSwitchActive: riskSettings.killSwitchActive,
  };
}

// ─────────────────────────────────────────────
// GET /api/risk/daily-pnl
// Returns today's realized P&L from closed trades
// ─────────────────────────────────────────────
router.get('/daily-pnl', async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    const pnlData = await calculateDailyPnL(settings);

    res.json({
      status: 'success',
      data: {
        ...pnlData,
        capital: settings.capital,
        riskPerTrade: settings.riskPerTrade,
        dailyLossLimitPct: settings.dailyLossLimitPct,
      },
    });
  } catch (err) {
    console.error('Error calculating daily P&L:', err.message);
    res.status(500).json({ status: 'error', message: 'Failed to calculate daily P&L' });
  }
});

// ─────────────────────────────────────────────
// GET /api/risk/monitor-health
// Returns trade monitor health status (last run, symbols checked, errors)
// ─────────────────────────────────────────────
router.get('/monitor-health', async (req, res) => {
  try {
    // app.locals.monitorHealth is set by the trade monitor cron in server.js
    const health = req.app.locals.monitorHealth || {
      lastRun: null,
      status: 'never_run',
      activeSetups: 0,
      symbolsChecked: 0,
      pricesFound: 0,
    };

    // Calculate time since last run
    let lastRunAgo = null;
    if (health.lastRun) {
      const diffMs = Date.now() - new Date(health.lastRun).getTime();
      const diffMin = Math.floor(diffMs / 60000);
      lastRunAgo = diffMin < 1 ? 'just now' : `${diffMin} min ago`;
    }

    res.json({
      status: 'success',
      data: {
        ...health,
        lastRunAgo,
        isHealthy: health.status === 'ok' || health.status === 'idle',
      },
    });
  } catch (err) {
    console.error('Error fetching monitor health:', err.message);
    res.status(500).json({ status: 'error', message: 'Failed to fetch monitor health' });
  }
});

// ─────────────────────────────────────────────
// GET /api/risk/monitor-test/:symbol
// Test price fetch for a specific symbol — shows what the monitor sees
// ─────────────────────────────────────────────
router.get('/monitor-test/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase().trim();
    const Instrument = require('../models/Instrument');
    const TradeSetup = require('../models/TradeSetup');
    const axios = require('axios');

    // Step 1: Find instrument key from DB
    const instrument = await Instrument.findOne({ symbol }).lean();
    if (!instrument || !instrument.isin) {
      return res.json({
        status: 'success',
        data: {
          symbol,
          step1_instrumentKey: null,
          error: `No instrument key found for ${symbol} in DB. This stock CANNOT be monitored.`,
          fix: 'Add this stock to the Instruments collection with its ISIN.',
        },
      });
    }

    const instrumentKey = `NSE_EQ|${instrument.isin}`;

    // Step 2: Fetch live price from Upstox REST API
    const token = process.env.UPSTOX_ACCESS_TOKEN;
    let livePrice = null;
    let priceError = null;

    if (!token || token === 'your_access_token_here') {
      priceError = 'No valid Upstox token — cannot fetch live price';
    } else {
      try {
        const response = await axios.get('https://api.upstox.com/v2/market-quote/ltp', {
          params: { instrument_key: instrumentKey },
          headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
          timeout: 10000,
        });
        if (response.data && response.data.data) {
          const key = Object.keys(response.data.data)[0];
          const value = response.data.data[key];
          livePrice = value?.last_price ?? value?.lastPrice ?? null;
        }
      } catch (e) {
        priceError = e.response?.data?.message || e.message;
      }
    }

    // Step 3: Find any active setups for this symbol
    const activeSetups = await TradeSetup.find({ symbol, status: 'ACTIVE' }).lean();
    const setupComparisons = activeSetups.map(setup => {
      const wouldTrigger = livePrice ? (() => {
        if (setup.action === 'BUY') {
          if (livePrice >= setup.target) return 'TARGET_HIT';
          if (livePrice <= setup.stopLoss) return 'SL_HIT';
        } else if (setup.action === 'SELL') {
          if (livePrice <= setup.target) return 'TARGET_HIT';
          if (livePrice >= setup.stopLoss) return 'SL_HIT';
        }
        return 'NO_TRIGGER';
      })() : 'UNKNOWN (no price)';

      return {
        setupId: setup._id,
        action: setup.action,
        entryPrice: setup.entryPrice,
        stopLoss: setup.stopLoss,
        target: setup.target,
        currentPriceInDB: setup.currentPrice,
        livePriceNow: livePrice,
        wouldTrigger,
      };
    });

    res.json({
      status: 'success',
      data: {
        symbol,
        step1_instrumentKey: instrumentKey,
        step1_isin: instrument.isin,
        step2_livePrice: livePrice,
        step2_priceError: priceError,
        step3_activeSetups: setupComparisons.length,
        step3_details: setupComparisons,
      },
    });
  } catch (err) {
    console.error('Error in monitor test:', err.message);
    res.status(500).json({ status: 'error', message: 'Monitor test failed: ' + err.message });
  }
});

// Export both the router and the calculateDailyPnL function
// (cron job in server.js needs calculateDailyPnL)
module.exports = router;
module.exports.calculateDailyPnL = calculateDailyPnL;
