const mongoose = require('mongoose');

/**
 * CollectionPlan Engine — standalone model.
 * NOT embedded in Project. Generates Payment entries after admin approval.
 * Payment model and project.amountPaid are only touched via auto-sync in routes.
 */

const GeneratedCollectionSchema = new mongoose.Schema({
  collectionDate: { type: Date, required: true },
  amount:         { type: Number, required: true },
  reason:         { type: String, default: '' },

  // Lifecycle status — stored (not computed from dates) because tracks user actions
  status: {
    type: String,
    enum: ['upcoming', 'pendingApproval', 'approved', 'rejected'],
    default: 'upcoming',
  },

  // Client proof upload (Cloudinary-ready, per Q1)
  proofImage: {
    url:        { type: String, default: '' },
    uploadedAt: { type: Date },
    fileType:   { type: String, default: '' },  // e.g. 'image/jpeg', 'image/png'
  },

  // Submission tracking (per Q3 — allows re-submission after rejection)
  proofSubmittedAt: { type: Date },
  lastSubmittedAt:  { type: Date },
  attemptCount:     { type: Number, default: 0 },

  // Admin approval/rejection
  approvedAt:      { type: Date },
  approvedBy:      { type: String, default: '' },   // admin name snapshot
  rejectedAt:      { type: Date },
  rejectionReason: { type: String, default: '' },

  // Reopen flow (per Q4 — approved entries can be reopened, edited, re-approved)
  reopenedAt:  { type: Date },
  reopenedBy:  { type: String, default: '' },
  isLocked:    { type: Boolean, default: false },   // true after approval, false after reopen

  // Auto-Payment sync — set after admin approval
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },

  // Audit snapshots — written at plan creation, survive client/project deletion
  clientNameSnapshot:   { type: String, default: '' },
  projectTitleSnapshot: { type: String, default: '' },
});

const CollectionPlanSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  clientId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },

  type: { type: String, enum: ['weekly', 'phase'], required: true },

  // ── Weekly collection fields ──────────────────────────────────
  // weeklyAmount stored in `amount` field below (shared)
  startDate:    { type: Date },
  endDate:      { type: Date },

  // ── Phase collection fields ───────────────────────────────────
  phaseName:    { type: String, default: '' },
  intervalDays: { type: Number, default: 7 },

  // ── Shared fields ─────────────────────────────────────────────
  amount:  { type: Number, required: true },   // per-collection amount
  reason:  { type: String, default: '' },

  // Optional link to a workflowCalendar item (_id as string)
  // If workflow changes later, collection remains intact — independent
  workflowItemId: { type: String, default: '' },

  // Plan lifecycle
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active',
  },

  // Audit snapshots at plan creation time
  clientNameSnapshot:   { type: String, default: '' },
  projectTitleSnapshot: { type: String, default: '' },

  generatedCollections: [GeneratedCollectionSchema],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('CollectionPlan', CollectionPlanSchema);
