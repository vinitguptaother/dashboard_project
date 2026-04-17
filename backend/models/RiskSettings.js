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
