/**
 * Master Refresh routes — endpoints for the Master Refresh Button.
 *
 * Endpoints:
 *   POST /api/master-refresh/run?mode=quick|full
 *     - quick: sync response with full results
 *     - full:  async — returns jobId immediately, poll status
 *   GET  /api/master-refresh/status/:jobId
 *   GET  /api/master-refresh/history?limit=10
 *   GET  /api/master-refresh/latest
 *
 * Rate limit: 1 run per 5 minutes (enforced inside the service).
 */

const express = require('express');
const router = express.Router();
const masterRefreshService = require('../services/masterRefreshService');

// ─── POST /run ─────────────────────────────────────────────────────────────
router.post('/run', async (req, res) => {
  const mode = (req.query.mode || req.body.mode || 'quick').toString().toLowerCase();
  const allowExpensive = req.query.allowExpensive === 'true' || req.body.allowExpensive === true;
  const trigger = (req.query.trigger || req.body.trigger || 'manual').toString().toLowerCase();

  if (mode !== 'quick' && mode !== 'full') {
    return res.status(400).json({
      status: 'error',
      message: `Invalid mode "${mode}". Must be "quick" or "full".`,
    });
  }

  // Quick mode: synchronous response — completes in ~20-40s.
  if (mode === 'quick') {
    try {
      const result = await masterRefreshService.runMasterRefresh({
        mode: 'quick',
        trigger: trigger === 'cron' ? 'cron' : 'manual',
        allowExpensive,
      });
      return res.json({ status: 'success', data: result });
    } catch (err) {
      if (err.code === 'COOLDOWN') {
        return res.status(429).json({
          status: 'error', message: err.message, code: 'COOLDOWN', remainingMs: err.remainingMs,
        });
      }
      if (err.code === 'COST_CAP') {
        return res.status(402).json({
          status: 'error', message: err.message, code: 'COST_CAP',
          estimatedUSD: err.estimatedUSD, capUSD: err.capUSD,
        });
      }
      return res.status(500).json({ status: 'error', message: err.message });
    }
  }

  // Full mode: async — kick off and return jobId immediately.
  try {
    // Pre-flight: reject for cooldown / cost cap BEFORE starting background work
    const remaining = masterRefreshService.getCooldownRemainingMs();
    if (remaining > 0 && trigger !== 'cron') {
      return res.status(429).json({
        status: 'error', message: `Master refresh on cooldown — ${Math.ceil(remaining / 1000)}s remaining`,
        code: 'COOLDOWN', remainingMs: remaining,
      });
    }

    // Kick off in background — don't await.
    const runPromise = masterRefreshService.runMasterRefresh({
      mode: 'full',
      trigger: trigger === 'cron' ? 'cron' : 'manual',
      allowExpensive,
    });

    // We need a jobId to return immediately. runMasterRefresh creates the job
    // internally and resolves with the final result, but we can poll the
    // registered runningJobs map after a brief tick.
    setImmediate(() => {
      runPromise.catch(err => console.error('[master-refresh:full] background run failed:', err.message));
    });

    // Wait up to 500ms for the job to register — long enough for the first
    // await (createRun) to complete, short enough to feel instant.
    let jobId = null;
    for (let i = 0; i < 25 && !jobId; i++) {
      await new Promise(r => setTimeout(r, 20));
      const snap = masterRefreshService.getLatestRunningJob();
      if (snap) jobId = snap.jobId;
    }

    return res.status(202).json({
      status: 'success',
      data: {
        jobId,
        mode: 'full',
        message: 'Full refresh started — poll /api/master-refresh/status/:jobId for progress.',
      },
    });
  } catch (err) {
    if (err.code === 'COST_CAP') {
      return res.status(402).json({
        status: 'error', message: err.message, code: 'COST_CAP',
        estimatedUSD: err.estimatedUSD, capUSD: err.capUSD,
      });
    }
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── GET /status/:jobId ────────────────────────────────────────────────────
router.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    // Prefer in-memory (live) snapshot for a running job.
    const live = masterRefreshService.getCurrentJob(jobId);
    if (live) {
      return res.json({ status: 'success', data: live });
    }
    // Fall back to persisted doc.
    const doc = await masterRefreshService.getRunById(jobId);
    if (!doc) {
      return res.status(404).json({ status: 'error', message: `Job ${jobId} not found` });
    }
    return res.json({ status: 'success', data: doc });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── GET /history ─────────────────────────────────────────────────────────
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '10', 10);
    const rows = await masterRefreshService.getRunHistory({ limit });
    return res.json({ status: 'success', data: rows });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── GET /latest ──────────────────────────────────────────────────────────
router.get('/latest', async (req, res) => {
  try {
    const doc = await masterRefreshService.getLatestRun();
    return res.json({
      status: 'success',
      data: doc || null,
      cooldownRemainingMs: masterRefreshService.getCooldownRemainingMs(),
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
