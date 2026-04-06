const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  title: { type: String, default: 'Untitled Note' },
  content: { type: String, default: '' },
  images: [{ type: String }], // base64 data URIs
  color: { type: String, default: '#fef9c3' }, // default yellow
  pinned: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Note', noteSchema);
