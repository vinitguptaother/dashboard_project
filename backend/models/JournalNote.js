/**
 * JournalNote — free-form trade/market notes. Phase 6 deliverable #4.
 *
 * Where used:
 *  - Voice journal entry (Whisper-transcribed audio)
 *  - Ad-hoc text notes attached to a TradeSetup (optional)
 *
 * IMPORTANT: we do NOT persist raw audio. Only the transcription.
 */

const mongoose = require('mongoose');

const journalNoteSchema = new mongoose.Schema({
  userId: {
    type: String,
    default: 'default',
    index: true,
  },
  content: {
    type: String,
    required: true,
    trim: true,
  },
  tradeSetupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TradeSetup',
    default: null,
    index: true,
  },
  source: {
    type: String,
    enum: ['voice', 'text'],
    default: 'text',
    index: true,
  },
  durationSec: {
    type: Number,
    default: null,  // voice recording length; null for text
  },
  transcriptionProvider: {
    type: String,
    default: '',    // e.g. 'openai-whisper', '' for text
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

module.exports = mongoose.model('JournalNote', journalNoteSchema);
