const mongoose = require('mongoose');

const TimelineEntrySchema = new mongoose.Schema({
  phase:    { type: String },
  status:   { type: String, enum: ['upcoming','in-progress','done'], default: 'upcoming' },
  date:     { type: Date },
  note:     { type: String },
});

const DesignFileSchema = new mongoose.Schema({
  name:     String,
  type:     { type: String, enum: ['2D Floor Plan','3D Render','Site Photo','Material Board'] },
  url:      String,
  approved: { type: Boolean, default: false },
  uploadedAt: { type: Date, default: Date.now },
});

const ProjectSchema = new mongoose.Schema({
  title:      { type: String, required: true },
  clientId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status:     { type: String, enum: ['consultation','design','material','execution','finishing','completed'], default: 'consultation' },
  progress:   { type: Number, min: 0, max: 100, default: 0 },
  package:    { type: String, enum: ['Basic','Standard','Premium'], default: 'Standard' },
  totalCost:  { type: Number, default: 0 },
  location:   { type: String },
  startDate:  { type: Date },
  endDate:    { type: Date },
  timeline:   [TimelineEntrySchema],
  designs:    [DesignFileSchema],
  createdAt:  { type: Date, default: Date.now },
});

module.exports = mongoose.model('Project', ProjectSchema);
