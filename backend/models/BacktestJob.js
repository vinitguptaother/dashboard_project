/**
 * BacktestJob — persisted record of a backtest run (sync or async).
 *
 * MASTER_PLAN §7 Phase 5.
 *
 * Async jobs create a doc immediately with status='running' and progress=0,
 * then the background worker patches progress and flips status to 'success'
 * or 'failure' with the full result.
 *
 * Sync jobs (small universe) may skip the worker path but still write the
 * final doc for history.
 */
const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
  symbol:        { type: String },
  entryDate:     { type: Date },
  entryPrice:    { type: Number },
  exitDate:      { type: Date },
  exitPrice:     { type: Number },
  exitReason:    { type: String, enum: ['TARGET_HIT', 'SL_HIT', 'TIME_EXIT', 'END_OF_PERIOD'], default: 'END_OF_PERIOD' },
  side:          { type: String, enum: ['BUY', 'SELL'], default: 'BUY' },
  qty:           { type: Number, default: 0 },
  stopLoss:      { type: Number },
  target:        { type: Number },
  grossPnL:      { type: Number },
  netPnL:        { type: Number },
  returnPct:     { type: Number },
  regimeAtEntry: { type: String, default: '' },
}, { _id: false });

const equityPointSchema = new mongoose.Schema({
  date:     { type: Date },
  equity:   { type: Number },
  drawdown: { type: Number, default: 0 },
}, { _id: false });

const backtestJobSchema = new mongoose.Schema({
  jobId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  strategyKey: { type: String, required: true, index: true },
  universe:    { type: [String], default: [] },
  period: {
    from: { type: Date },
    to:   { type: Date },
    days: { type: Number, default: 0 },
  },
  config: {
    initialCapital:   { type: Number, default: 500000 },
    riskPerTradePct:  { type: Number, default: 2 },
    regimeFilter:     { type: String, default: '' },
  },

  status: {
    type: String,
    enum: ['running', 'success', 'failure'],
    default: 'running',
    index: true,
  },
  progress: { type: Number, default: 0, min: 0, max: 100 },

  // Full backtest result — same shape backtestService.runBacktest returns.
  result: {
    totalTrades:    { type: Number, default: 0 },
    wins:           { type: Number, default: 0 },
    losses:         { type: Number, default: 0 },
    winRate:        { type: Number, default: null },
    avgReturnPct:   { type: Number, default: null },
    totalReturnPct: { type: Number, default: null },
    sharpe:         { type: Number, default: null },
    sortino:        { type: Number, default: null },
    profitFactor:   { type: Number, default: null },
    maxDrawdown:    { type: Number, default: null },
    maxDDDuration:  { type: Number, default: null }, // in calendar days
    equityCurve:    { type: [equityPointSchema], default: [] },
    byRegime:       { type: mongoose.Schema.Types.Mixed, default: {} },
    byMonth:        { type: [mongoose.Schema.Types.Mixed], default: [] },
    trades:         { type: [tradeSchema], default: [] },
    runDurationMs:  { type: Number, default: 0 },
    finalEquity:    { type: Number, default: null },
  },

  error: { type: String, default: '' },
  startedAt:   { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

backtestJobSchema.index({ strategyKey: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('BacktestJob', backtestJobSchema);
