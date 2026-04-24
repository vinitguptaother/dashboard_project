/**
 * journalVoice.js — voice journal entry endpoint.
 *
 * MASTER_PLAN §7 Phase 6 deliverable #4.
 *
 * POST /api/journal/voice
 *   Body: multipart/form-data
 *     - audio         (Blob) — audio recording, ≤ 60 sec
 *     - tradeSetupId  (text, optional)
 *     - durationSec   (text, optional)
 *
 * Flow:
 *  1. Parse multipart payload (self-contained — no multer dependency).
 *  2. Try Whisper transcription via llmService.whisperTranscribe.
 *  3. If no OPENAI_API_KEY or transcription fails: gracefully fall back
 *     to a stub transcription so the UI pipeline still works for testing.
 *  4. Persist JournalNote (optionally attached to TradeSetup).
 *
 * Raw audio is NEVER stored persistently — only the transcription.
 */

const express = require('express');
const router = express.Router();
const JournalNote = require('../models/JournalNote');

let TradeSetup = null;
try { TradeSetup = require('../models/TradeSetup'); } catch (_) {}

let llmService = null;
try { llmService = require('../services/llmService'); } catch (_) {}

// ─── Minimal RFC 1867 multipart parser (single-file / small-payload) ─────────
// Good enough for our voice clips (~500KB max). Avoids adding `multer`.
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const ct = req.headers['content-type'] || '';
    const m = ct.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!m) return reject(new Error('Missing multipart boundary'));
    const boundary = `--${m[1] || m[2]}`;

    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const buf = Buffer.concat(chunks);
        const parts = [];
        let start = 0;
        const bBuf = Buffer.from(boundary);
        while (start < buf.length) {
          const bStart = buf.indexOf(bBuf, start);
          if (bStart < 0) break;
          const partStart = bStart + bBuf.length + 2; // skip \r\n after boundary
          const nextB = buf.indexOf(bBuf, partStart);
          if (nextB < 0) break;
          const partEnd = nextB - 2; // strip \r\n before next boundary
          const partBuf = buf.slice(partStart, partEnd);
          const headerEnd = partBuf.indexOf('\r\n\r\n');
          if (headerEnd < 0) { start = nextB; continue; }
          const headerStr = partBuf.slice(0, headerEnd).toString('utf8');
          const bodyBuf = partBuf.slice(headerEnd + 4);

          const disp = /content-disposition:\s*form-data;\s*([^\r\n]+)/i.exec(headerStr);
          if (!disp) { start = nextB; continue; }
          const nameMatch = /name="([^"]+)"/i.exec(disp[1]);
          const filenameMatch = /filename="([^"]*)"/i.exec(disp[1]);
          const name = nameMatch ? nameMatch[1] : '';
          const filename = filenameMatch ? filenameMatch[1] : '';
          const ctMatch = /content-type:\s*([^\r\n]+)/i.exec(headerStr);
          const contentType = ctMatch ? ctMatch[1].trim() : 'application/octet-stream';

          parts.push({ name, filename, contentType, data: bodyBuf });
          start = nextB;
        }
        resolve(parts);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// ─── Whisper fallback ───────────────────────────────────────────────────────
async function tryTranscribe(audioBuf, filename, mime) {
  // If llmService exposes whisperTranscribe, use it.
  if (llmService && typeof llmService.whisperTranscribe === 'function') {
    try {
      const { text, provider } = await llmService.whisperTranscribe({
        audioBuffer: audioBuf, filename, mimeType: mime,
      });
      return { text: text || '', provider: provider || 'openai-whisper', ok: true };
    } catch (err) {
      console.warn('[journalVoice] whisperTranscribe failed:', err.message);
      // fall through to stub
    }
  }
  // Fallback: we can't transcribe, but we still want the pipeline to work.
  return {
    text: `[Voice note — ${(audioBuf.length / 1024).toFixed(1)} KB, transcription unavailable. Configure OPENAI_API_KEY to enable Whisper.]`,
    provider: 'stub',
    ok: false,
  };
}

// ─── POST /api/journal/voice ─────────────────────────────────────────────────
router.post('/voice', async (req, res) => {
  try {
    const parts = await parseMultipart(req);

    const audioPart = parts.find((p) => p.name === 'audio');
    if (!audioPart || !audioPart.data || audioPart.data.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Missing audio field' });
    }
    if (audioPart.data.length > 10 * 1024 * 1024) {
      return res.status(413).json({ status: 'error', message: 'Audio too large (> 10 MB)' });
    }

    const tradeSetupIdPart = parts.find((p) => p.name === 'tradeSetupId');
    const durationPart = parts.find((p) => p.name === 'durationSec');
    const tradeSetupId = tradeSetupIdPart ? tradeSetupIdPart.data.toString('utf8').trim() : '';
    const durationSec = durationPart ? parseFloat(durationPart.data.toString('utf8')) : null;

    // Transcribe (or stub)
    const { text, provider, ok } = await tryTranscribe(
      audioPart.data, audioPart.filename || 'audio.webm', audioPart.contentType
    );

    // Save JournalNote
    const noteDoc = new JournalNote({
      content: text,
      tradeSetupId: tradeSetupId && /^[0-9a-fA-F]{24}$/.test(tradeSetupId) ? tradeSetupId : null,
      source: 'voice',
      durationSec: Number.isFinite(durationSec) ? durationSec : null,
      transcriptionProvider: provider,
    });
    await noteDoc.save();

    // If attached to a trade setup — append a short trail into the reasoning field
    // (schema has no journal array; JournalNote is the canonical store).
    if (noteDoc.tradeSetupId && TradeSetup) {
      try {
        const setup = await TradeSetup.findById(noteDoc.tradeSetupId).lean();
        if (setup && (setup.reasoning || '').length < 4000) {
          const prefix = `\n[voice journal · ${new Date().toISOString()}] `;
          await TradeSetup.findByIdAndUpdate(noteDoc.tradeSetupId, {
            $set: { reasoning: (setup.reasoning || '') + prefix + text.slice(0, 500) },
          });
        }
      } catch (err) {
        console.warn('[journalVoice] failed to attach to TradeSetup:', err.message);
      }
    }

    return res.json({
      status: 'success',
      data: {
        note: {
          _id: noteDoc._id,
          content: noteDoc.content,
          source: noteDoc.source,
          tradeSetupId: noteDoc.tradeSetupId,
          createdAt: noteDoc.createdAt,
        },
        transcription: {
          provider,
          transcribed: ok,
          length: text.length,
        },
      },
    });
  } catch (err) {
    console.error('[journalVoice] error:', err.message);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── GET /api/journal/voice — list recent voice notes ───────────────────────
router.get('/voice', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const notes = await JournalNote.find({ source: 'voice' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json({ status: 'success', count: notes.length, data: notes });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
