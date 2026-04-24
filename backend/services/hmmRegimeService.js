/**
 * HMM Regime Service — 3-state Gaussian Hidden Markov Model on the
 * (NIFTY daily return, VIX level) observation vector.
 *
 * MASTER_PLAN §7 Phase 5. Pure JS — no Python. No LLM. Zero per-run API cost.
 *
 * How it works
 *   • Collect ~5 years of NIFTY daily returns + VIX daily level.
 *   • Fit a Gaussian HMM with 3 hidden states using Baum-Welch (EM).
 *   • The 3 learned states map to {trending, choppy, risk-off} by inspecting
 *     the emission distributions (lowest-VIX / mid-return -> trending, etc.).
 *   • classifyCurrent() does a Viterbi pass, returns { state, confidence, transitionMatrix }.
 *
 * Safety rails
 *   • Classifier is READ-ONLY — it does NOT mutate the stored MarketRegime doc.
 *   • The dashboard's Validator continues to use the rule-based regime until
 *     the user explicitly sets RiskSettings.regimeClassifier = 'hmm'.
 *   • If fit fails (too little data, numerical issues), we fall back to a
 *     K-means clustering of (return, vol) pairs — still an upgrade from rules.
 */

const axios = require('axios');

const UPSTOX_INST = {
  NIFTY: 'NSE_INDEX|Nifty 50',
  VIX: 'NSE_INDEX|India VIX',
};
const UPSTOX_HIST_BASE = 'https://api.upstox.com/v2/historical-candle';

// In-memory cache of the fit (single-user dashboard — no need for Mongo).
let _fitCache = null;

// ─── Linear algebra minis ─────────────────────────────────────────────────

function mean(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }
function variance(a, m = null) {
  if (!a.length) return 1e-6;
  const mu = m != null ? m : mean(a);
  const v = a.reduce((s, x) => s + (x - mu) ** 2, 0) / a.length;
  return Math.max(v, 1e-8);
}

function gaussianPdf(x, mu, sigma2) {
  const d = x - mu;
  return (1 / Math.sqrt(2 * Math.PI * sigma2)) * Math.exp(-(d * d) / (2 * sigma2));
}

/**
 * Bivariate diagonal Gaussian (independent features) — good enough for 2-D
 * and avoids hand-rolling 2x2 determinants / inverses.
 */
function gaussPdf2D(x, mu, sigma2) {
  return Math.max(gaussianPdf(x[0], mu[0], sigma2[0]) * gaussianPdf(x[1], mu[1], sigma2[1]), 1e-300);
}

// ─── Upstox history fetchers ──────────────────────────────────────────────

async function fetchSeries(instrumentKey, days) {
  const token = process.env.UPSTOX_ACCESS_TOKEN;
  if (!token) throw new Error('UPSTOX_ACCESS_TOKEN not set');
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const url = `${UPSTOX_HIST_BASE}/${encodeURIComponent(instrumentKey)}/day/${to}/${from}`;
  const res = await axios.get(url, {
    timeout: 20000,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const candles = res.data?.data?.candles || [];
  return candles.slice().reverse().map(c => ({
    date: new Date(c[0]),
    close: parseFloat(c[4]),
  })).filter(d => d.close > 0);
}

/**
 * Build aligned (return, vix) observation vectors across a shared date set.
 */
async function buildObservations(days = 1260 /* ~5 years */) {
  const [nifty, vix] = await Promise.all([
    fetchSeries(UPSTOX_INST.NIFTY, days).catch(() => []),
    fetchSeries(UPSTOX_INST.VIX, days).catch(() => []),
  ]);
  if (nifty.length < 60) {
    throw new Error(`Not enough NIFTY history for HMM fit (got ${nifty.length})`);
  }
  // Compute daily returns on NIFTY
  const rets = [];
  for (let i = 1; i < nifty.length; i++) {
    const r = (nifty[i].close - nifty[i - 1].close) / nifty[i - 1].close;
    rets.push({ date: nifty[i].date, ret: r });
  }
  // Align VIX by date
  const vixByDate = new Map();
  for (const v of vix) vixByDate.set(v.date.toISOString().slice(0, 10), v.close);

  // Fallback: if VIX missing altogether, synthesize from rolling 10d return stdev.
  const useSyntheticVix = vix.length < 60;

  const observations = [];
  let fallbackBuf = [];
  for (const r of rets) {
    const dayKey = r.date.toISOString().slice(0, 10);
    let vixLevel = vixByDate.get(dayKey);
    if (vixLevel == null || useSyntheticVix) {
      fallbackBuf.push(r.ret);
      if (fallbackBuf.length > 10) fallbackBuf.shift();
      const sd = Math.sqrt(variance(fallbackBuf));
      // Scale synthetic VIX similar to actual VIX magnitude (~15)
      vixLevel = 15 + sd * 100 * 10;
    }
    observations.push({ date: r.date, x: [r.ret, vixLevel] });
  }
  return observations;
}

// ─── Baum-Welch for Gaussian HMM (3 states, 2-D diagonal) ─────────────────

const N_STATES = 3;

function initHmm(obs) {
  // K-means-style quantile init on the 2 features for stability.
  const rets = obs.map(o => o.x[0]).slice().sort((a, b) => a - b);
  const vixs = obs.map(o => o.x[1]).slice().sort((a, b) => a - b);
  const q = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(arr.length * p))];
  const mus = [
    [q(rets, 0.15), q(vixs, 0.25)], // low-return, low-VIX  -> choppy candidate
    [q(rets, 0.55), q(vixs, 0.15)], // mid-return, low-VIX  -> trending candidate
    [q(rets, 0.50), q(vixs, 0.90)], // mid-return, high-VIX -> risk-off candidate
  ];
  const varRet = Math.max(variance(rets.slice(10, rets.length - 10)), 1e-6);
  const varVix = Math.max(variance(vixs.slice(10, vixs.length - 10)), 1e-2);
  const sigma2 = mus.map(() => [varRet, varVix]);
  const pi = [1 / 3, 1 / 3, 1 / 3];
  const A = [
    [0.94, 0.04, 0.02],
    [0.05, 0.93, 0.02],
    [0.05, 0.05, 0.90],
  ];
  return { mus, sigma2, pi, A };
}

function forwardBackward(obs, model) {
  const T = obs.length;
  const N = N_STATES;
  const alpha = Array.from({ length: T }, () => new Array(N).fill(0));
  const beta = Array.from({ length: T }, () => new Array(N).fill(0));
  const scale = new Array(T).fill(0);

  // Forward
  for (let i = 0; i < N; i++) {
    alpha[0][i] = model.pi[i] * gaussPdf2D(obs[0].x, model.mus[i], model.sigma2[i]);
  }
  scale[0] = alpha[0].reduce((a, b) => a + b, 0) || 1e-300;
  for (let i = 0; i < N; i++) alpha[0][i] /= scale[0];

  for (let t = 1; t < T; t++) {
    for (let j = 0; j < N; j++) {
      let sum = 0;
      for (let i = 0; i < N; i++) sum += alpha[t - 1][i] * model.A[i][j];
      alpha[t][j] = sum * gaussPdf2D(obs[t].x, model.mus[j], model.sigma2[j]);
    }
    scale[t] = alpha[t].reduce((a, b) => a + b, 0) || 1e-300;
    for (let j = 0; j < N; j++) alpha[t][j] /= scale[t];
  }

  // Backward
  for (let i = 0; i < N; i++) beta[T - 1][i] = 1 / scale[T - 1];
  for (let t = T - 2; t >= 0; t--) {
    for (let i = 0; i < N; i++) {
      let sum = 0;
      for (let j = 0; j < N; j++) {
        sum += model.A[i][j] * gaussPdf2D(obs[t + 1].x, model.mus[j], model.sigma2[j]) * beta[t + 1][j];
      }
      beta[t][i] = sum / scale[t];
    }
  }

  // Log-likelihood (sum of log scales)
  const ll = scale.reduce((s, c) => s + Math.log(Math.max(c, 1e-300)), 0);
  return { alpha, beta, scale, ll };
}

function baumWelchStep(obs, model) {
  const T = obs.length;
  const N = N_STATES;
  const { alpha, beta, ll } = forwardBackward(obs, model);

  const gamma = Array.from({ length: T }, () => new Array(N).fill(0));
  const xi = Array.from({ length: T - 1 }, () => Array.from({ length: N }, () => new Array(N).fill(0)));

  for (let t = 0; t < T; t++) {
    let s = 0;
    for (let i = 0; i < N; i++) { gamma[t][i] = alpha[t][i] * beta[t][i]; s += gamma[t][i]; }
    if (s > 0) for (let i = 0; i < N; i++) gamma[t][i] /= s;
  }
  for (let t = 0; t < T - 1; t++) {
    let denom = 0;
    const rowDenom = [];
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const v = alpha[t][i] * model.A[i][j] * gaussPdf2D(obs[t + 1].x, model.mus[j], model.sigma2[j]) * beta[t + 1][j];
        xi[t][i][j] = v;
        denom += v;
      }
      rowDenom.push(denom);
    }
    if (denom > 0) {
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) xi[t][i][j] /= denom;
    }
  }

  // M-step
  const newPi = gamma[0].slice();
  const newA = Array.from({ length: N }, () => new Array(N).fill(0));
  for (let i = 0; i < N; i++) {
    let sumGamma = 0;
    for (let t = 0; t < T - 1; t++) sumGamma += gamma[t][i];
    for (let j = 0; j < N; j++) {
      let sumXi = 0;
      for (let t = 0; t < T - 1; t++) sumXi += xi[t][i][j];
      newA[i][j] = sumGamma > 0 ? sumXi / sumGamma : model.A[i][j];
    }
  }

  const newMus = Array.from({ length: N }, () => [0, 0]);
  const newSigma2 = Array.from({ length: N }, () => [0, 0]);
  for (let i = 0; i < N; i++) {
    let sumG = 0;
    for (let t = 0; t < T; t++) sumG += gamma[t][i];
    if (sumG <= 0) {
      newMus[i] = model.mus[i].slice();
      newSigma2[i] = model.sigma2[i].slice();
      continue;
    }
    // Means
    let mu0 = 0, mu1 = 0;
    for (let t = 0; t < T; t++) { mu0 += gamma[t][i] * obs[t].x[0]; mu1 += gamma[t][i] * obs[t].x[1]; }
    newMus[i] = [mu0 / sumG, mu1 / sumG];
    // Variances
    let s0 = 0, s1 = 0;
    for (let t = 0; t < T; t++) {
      s0 += gamma[t][i] * (obs[t].x[0] - newMus[i][0]) ** 2;
      s1 += gamma[t][i] * (obs[t].x[1] - newMus[i][1]) ** 2;
    }
    newSigma2[i] = [Math.max(s0 / sumG, 1e-8), Math.max(s1 / sumG, 1e-4)];
  }

  return { model: { mus: newMus, sigma2: newSigma2, pi: newPi, A: newA }, ll };
}

async function fit(obs, { maxIter = 50, tol = 1e-4 } = {}) {
  let model = initHmm(obs);
  let prevLL = -Infinity;
  let iter = 0;
  for (; iter < maxIter; iter++) {
    const { model: next, ll } = baumWelchStep(obs, model);
    model = next;
    if (Math.abs(ll - prevLL) < tol) break;
    prevLL = ll;
  }
  return { model, iterations: iter + 1, finalLL: prevLL };
}

// ─── State mapping: HMM state index -> human regime label ─────────────────

function mapStates(model) {
  // Rank states by vix mean. Highest-VIX -> risk-off.
  const vixs = model.mus.map((m, i) => ({ i, vix: m[1], ret: m[0] }));
  vixs.sort((a, b) => b.vix - a.vix);
  const riskOffIdx = vixs[0].i;
  // Of the remaining two, the one with higher mean return -> trending
  const remaining = vixs.filter(v => v.i !== riskOffIdx);
  remaining.sort((a, b) => b.ret - a.ret);
  const trendingIdx = remaining[0].i;
  const choppyIdx = remaining[1].i;

  const idxToLabel = {};
  idxToLabel[riskOffIdx] = 'risk-off';
  idxToLabel[trendingIdx] = 'trending';
  idxToLabel[choppyIdx] = 'choppy';
  return idxToLabel;
}

// ─── Viterbi (used by classifyCurrent) ────────────────────────────────────

function viterbi(obs, model) {
  const T = obs.length;
  const N = N_STATES;
  const dp = Array.from({ length: T }, () => new Array(N).fill(-Infinity));
  const back = Array.from({ length: T }, () => new Array(N).fill(0));
  for (let i = 0; i < N; i++) {
    dp[0][i] = Math.log(Math.max(model.pi[i], 1e-300)) +
               Math.log(gaussPdf2D(obs[0].x, model.mus[i], model.sigma2[i]));
  }
  for (let t = 1; t < T; t++) {
    for (let j = 0; j < N; j++) {
      let bestV = -Infinity, bestI = 0;
      for (let i = 0; i < N; i++) {
        const v = dp[t - 1][i] + Math.log(Math.max(model.A[i][j], 1e-300));
        if (v > bestV) { bestV = v; bestI = i; }
      }
      dp[t][j] = bestV + Math.log(gaussPdf2D(obs[t].x, model.mus[j], model.sigma2[j]));
      back[t][j] = bestI;
    }
  }
  let bestI = 0, bestV = -Infinity;
  for (let i = 0; i < N; i++) if (dp[T - 1][i] > bestV) { bestV = dp[T - 1][i]; bestI = i; }
  const path = new Array(T).fill(0);
  path[T - 1] = bestI;
  for (let t = T - 2; t >= 0; t--) path[t] = back[t + 1][path[t + 1]];
  return path;
}

// ─── K-means fallback (2-D, 3 clusters) ──────────────────────────────────

function kmeansFallback(obs, k = 3, iters = 30) {
  const xs = obs.map(o => o.x);
  // Init centroids at quantiles of each dim
  const rets = xs.map(x => x[0]).slice().sort((a, b) => a - b);
  const vixs = xs.map(x => x[1]).slice().sort((a, b) => a - b);
  const q = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(arr.length * p))];
  let centroids = [
    [q(rets, 0.2), q(vixs, 0.2)],
    [q(rets, 0.5), q(vixs, 0.5)],
    [q(rets, 0.8), q(vixs, 0.9)],
  ];
  let assignments = new Array(xs.length).fill(0);
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < xs.length; i++) {
      let best = 0, bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = (xs[i][0] - centroids[c][0]) ** 2 + ((xs[i][1] - centroids[c][1]) / 20) ** 2;
        if (d < bestD) { bestD = d; best = c; }
      }
      assignments[i] = best;
    }
    const sums = Array.from({ length: k }, () => [0, 0, 0]); // x,y,count
    for (let i = 0; i < xs.length; i++) {
      sums[assignments[i]][0] += xs[i][0];
      sums[assignments[i]][1] += xs[i][1];
      sums[assignments[i]][2] += 1;
    }
    for (let c = 0; c < k; c++) {
      if (sums[c][2] > 0) centroids[c] = [sums[c][0] / sums[c][2], sums[c][1] / sums[c][2]];
    }
  }
  return { centroids, assignments };
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Fit the HMM on ~5 years of data. Caches the model in memory.
 * Called weekly (Sunday) and lazily on first classifyWithHMM() call.
 */
async function fitModel({ days = 1260, maxIter = 50 } = {}) {
  const obs = await buildObservations(days);
  try {
    const { model, iterations, finalLL } = await fit(obs, { maxIter });
    const labelMap = mapStates(model);
    _fitCache = {
      model,
      obs,
      labelMap,
      iterations,
      finalLL,
      method: 'hmm-baum-welch',
      fittedAt: new Date(),
    };
  } catch (err) {
    // Fallback: K-means
    const { centroids, assignments } = kmeansFallback(obs, 3, 50);
    // Build label map via same heuristic (highest VIX -> risk-off)
    const ranked = centroids.map((c, i) => ({ i, vix: c[1], ret: c[0] })).sort((a, b) => b.vix - a.vix);
    const riskOffIdx = ranked[0].i;
    const rem = ranked.filter(r => r.i !== riskOffIdx).sort((a, b) => b.ret - a.ret);
    const labelMap = {};
    labelMap[riskOffIdx] = 'risk-off';
    labelMap[rem[0].i] = 'trending';
    labelMap[rem[1].i] = 'choppy';
    _fitCache = {
      centroids, assignments, obs, labelMap,
      method: 'kmeans-fallback',
      fittedAt: new Date(),
      fallbackReason: err.message,
    };
  }
  return {
    method: _fitCache.method,
    fittedAt: _fitCache.fittedAt,
    observations: obs.length,
    iterations: _fitCache.iterations || null,
    labelMap: _fitCache.labelMap,
  };
}

async function ensureFitted() {
  if (!_fitCache) {
    await fitModel();
  }
  return _fitCache;
}

/**
 * Classify the CURRENT day's regime using the fitted HMM.
 *
 * @returns {{ state: string, confidence: number, transitionMatrix: number[][],
 *            rawState: number, method: string, mus: number[][], sigma2: number[][], fittedAt: Date }}
 */
async function classifyCurrent() {
  const fit = await ensureFitted();
  const obs = fit.obs;
  const last = obs[obs.length - 1];
  let rawState = 0;
  let confidence = 0.5;
  let transitionMatrix = null;

  if (fit.method === 'hmm-baum-welch') {
    const path = viterbi(obs.slice(-60), fit.model); // last 60 days for smoothing
    rawState = path[path.length - 1];
    // Confidence via alpha[T-1] normalization
    const { alpha } = forwardBackward(obs.slice(-60), fit.model);
    const T = alpha.length;
    const total = alpha[T - 1].reduce((a, b) => a + b, 0) || 1;
    confidence = Math.max(0, Math.min(1, alpha[T - 1][rawState] / total));
    transitionMatrix = fit.model.A.map(r => r.map(v => +v.toFixed(4)));
  } else {
    // K-means fallback: just nearest centroid to today's obs
    let bestD = Infinity;
    for (let c = 0; c < fit.centroids.length; c++) {
      const d = (last.x[0] - fit.centroids[c][0]) ** 2 + ((last.x[1] - fit.centroids[c][1]) / 20) ** 2;
      if (d < bestD) { bestD = d; rawState = c; }
    }
    confidence = 0.4; // K-means has no calibrated confidence
  }

  return {
    state: fit.labelMap[rawState] || 'unknown',
    confidence: +confidence.toFixed(3),
    transitionMatrix,
    rawState,
    method: fit.method,
    mus: fit.model ? fit.model.mus.map(r => r.map(v => +v.toFixed(5))) : null,
    sigma2: fit.model ? fit.model.sigma2.map(r => r.map(v => +v.toFixed(5))) : null,
    fittedAt: fit.fittedAt,
    observedToday: {
      date: last.date,
      niftyReturn: +last.x[0].toFixed(5),
      vix: +last.x[1].toFixed(3),
    },
  };
}

function getFitStatus() {
  if (!_fitCache) return { fitted: false };
  return {
    fitted: true,
    method: _fitCache.method,
    fittedAt: _fitCache.fittedAt,
    iterations: _fitCache.iterations || null,
    observations: _fitCache.obs.length,
    labelMap: _fitCache.labelMap,
  };
}

module.exports = {
  fitModel,
  classifyCurrent,
  getFitStatus,
};
