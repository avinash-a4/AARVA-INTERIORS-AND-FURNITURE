const mongoose = require('mongoose');

const QuerySchema = new mongoose.Schema({
  clientId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  message:   { type: String, required: true },
  status:    { type: String, enum: ['open', 'resolved'], default: 'open' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Query', QuerySchema);
