const express = require('express');
const router = express.Router();
const Note = require('../models/Note');

// Get all notes
router.get('/', async (req, res) => {
  try {
    const notes = await Note.find().sort({ pinned: -1, updatedAt: -1 });
    res.json({ status: 'success', data: notes });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// Create note
router.post('/', async (req, res) => {
  try {
    const note = await Note.create(req.body);
    res.json({ status: 'success', data: note });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// Update note
router.put('/:id', async (req, res) => {
  try {
    const note = await Note.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!note) return res.status(404).json({ status: 'error', message: 'Not found' });
    res.json({ status: 'success', data: note });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// Delete note
router.delete('/:id', async (req, res) => {
  try {
    await Note.findByIdAndDelete(req.params.id);
    res.json({ status: 'success' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

module.exports = router;
