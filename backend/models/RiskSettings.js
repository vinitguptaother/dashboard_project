// backend/models/RiskSettings.js
// What this does: Stores your trading risk settings — capital, risk per trade,
// position limits, and daily loss limits. Used by the Position Sizing Calculator
// to tell you exactly how many shares to buy for each trade.

const mongoose = require('mongoose');

const riskSettingsSchema = new mongoose.Schema({
  // Single-user dashboard — one record with userId 'default'
  userId: {
    type: String,
    default: 'default',
    unique: true,
  },

  // Your total trading capital in ₹
  capital: {
    type: Number,
    default: 500000,
    min: 10000,
  },

  // Max % of capital you risk on a single trade (typical: 1-3%)
  riskPerTrade: {
    type: Number,
    default: 2,
    min: 0.5,
    max: 10,
  },

  // Max % of capital in a single position (prevents over-concentration)
  maxPositionPct: {
    type: Number,
    default: 20,
    min: 5,
    max: 100,
  },

  // Daily loss limit as % of capital — triggers kill switch
  dailyLossLimitPct: {
    type: Number,
    default: 5,
    min: 1,
    max: 25,
  },

  // Or set a fixed ₹ daily loss limit (whichever hits first)
  dailyLossLimitAmount: {
    type: Number,
    default: null,
  },

  // Kill switch state — when true, blocks new trade setup generation
  killSwitchActive: {
    type: Boolean,
    default: false,
  },

  // Date when kill switch was activated (resets at midnight IST)
  killSwitchDate: {
    type: Date,
    default: null,
  },

  // Post-Loss Cooldown (BOT_BLUEPRINT item #16) — after 2 consecutive losses,
  // trade buttons disabled until this timestamp.
  cooldownUntil: {
    type: Date,
    default: null,
  },
  cooldownReason: {
    type: String,
    default: '',
  },

  // BOT_BLUEPRINT #10 — Risk Engine fields
  // Per-bot capital allocation (Sprint 4 prep for 4-bot architecture).
  // When bots are live these slices gate how much each bot can deploy.
  // Sum should usually equal `capital` (not enforced — user can intentionally
  // keep some as reserve).
  botCapital: {
    swing:        { type: Number, default: 200000 },
    longterm:     { type: Number, default: 200000 },
    optionsSell:  { type: Number, default: 50000 },
    optionsBuy:   { type: Number, default: 50000 },
  },

  // Max concurrent open positions per bot — prevents over-diversification /
  // slippage from spray-and-pray signals.
  maxConcurrentPositions: {
    swing:        { type: Number, default: 5 },
    longterm:     { type: Number, default: 10 },
    optionsSell:  { type: Number, default: 3 },
    optionsBuy:   { type: Number, default: 3 },
  },

  // Max % of capital in a single sector (NSE sector classification).
  // e.g. 30% means if IT already has ₹1.5L exposure on ₹5L capital, new IT
  // trades are blocked.
  maxSectorConcentrationPct: {
    type: Number, default: 30, min: 5, max: 100,
  },

  // Drawdown lockout — once cumulative equity drops this % from peak,
  // no new entries allowed until user manually resets (analogous to
  // kill switch but longer-term).
  maxDrawdownPct: {
    type: Number, default: 15, min: 5, max: 50,
  },
  drawdownLockoutActive: {
    type: Boolean, default: false,
  },
  drawdownLockoutTriggeredAt: {
    type: Date, default: null,
  },

  // BOT_BLUEPRINT #11 — Per-bot manual kill switches. One bot can be killed
  // without halting the others. `all` flag is set by Panic button.
  botKillSwitches: {
    swing:       { active: { type: Boolean, default: false }, reason: { type: String, default: '' }, activatedAt: { type: Date, default: null } },
    longterm:    { active: { type: Boolean, default: false }, reason: { type: String, default: '' }, activatedAt: { type: Date, default: null } },
    optionsSell: { active: { type: Boolean, default: false }, reason: { type: String, default: '' }, activatedAt: { type: Date, default: null } },
    optionsBuy:  { active: { type: Boolean, default: false }, reason: { type: String, default: '' }, activatedAt: { type: Date, default: null } },
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

riskSettingsSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('RiskSettings', riskSettingsSchema);
