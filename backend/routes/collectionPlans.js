/**
 * Collection Plan Engine — Routes
 * Admin router: /api/admin/collection-plans
 * Client router: /api/client/collections
 *
 * ⚠️  Zero existing routes are modified.
 *     Payment.create() and Project.$inc amountPaid are called only after approval.
 *     Financial, workflow, design, query, auth routes: untouched.
 */

const express       = require('express');
const adminRouter   = express.Router();
const clientRouter  = express.Router();

const CollectionPlan = require('../models/CollectionPlan');
const Payment        = require('../models/Payment');
const Project        = require('../models/Project');
const User           = require('../models/User');
const cloudinary     = require('../config/cloudinary');
const upload         = require('../middleware/upload');
const { protect, adminOnly } = require('../middleware/auth');

// ── Auth guards ──────────────────────────────────────────────────
adminRouter.use(protect, adminOnly);
clientRouter.use(protect);

// ── HELPERS ───────────────────────────────────────────────────────

/** Generate collection dates between startDate and endDate at intervalDays spacing.
 *  Dates are always treated as UTC midnight to prevent timezone off-by-1 errors.
 *  Input: ISO date strings 'YYYY-MM-DD' or Date objects.
 */
function generateDates(startDate, endDate, intervalDays) {
  const dates = [];
  // Parse to UTC midnight regardless of server timezone (IST, PST, etc.)
  const toUtcMidnight = (d) => {
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [y, m, day] = d.split('-').map(Number);
      return Date.UTC(y, m - 1, day); // month is 0-indexed
    }
    // For Date objects or ISO strings with time: strip to UTC date only
    const dt = new Date(d);
    return Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
  };

  let currentMs = toUtcMidnight(startDate);
  const endMs   = toUtcMidnight(endDate);
  const stepMs  = intervalDays * 86400000;

  while (currentMs <= endMs) {
    dates.push(new Date(currentMs)); // stored as UTC midnight Date
    currentMs += stepMs;
  }
  return dates;
}

/** Upload a buffer to Cloudinary under collection-proofs folder */
async function uploadToCloudinary(buffer, mimetype, folder, publicId) {
  return new Promise((resolve, reject) => {
    const isImage = mimetype.startsWith('image/');
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: isImage ? 'image' : 'raw',
        public_id: publicId,
        format: !isImage ? 'pdf' : undefined,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

// ════════════════════════════════════════════════════════════════
//  ADMIN ROUTES
// ════════════════════════════════════════════════════════════════

// POST /api/admin/collection-plans — create plan + auto-generate collections
adminRouter.post('/', async (req, res) => {
  try {
    const {
      projectId, clientId, type,
      startDate, endDate,
      phaseName, intervalDays,
      amount, reason,
      workflowItemId,
    } = req.body;

    if (!projectId || !clientId || !type || !amount || !startDate || !endDate) {
      return res.status(400).json({ message: 'projectId, clientId, type, amount, startDate, endDate are required' });
    }
    if (!['weekly', 'phase'].includes(type)) {
      return res.status(400).json({ message: 'type must be "weekly" or "phase"' });
    }

    const interval = type === 'weekly' ? 7 : (Number(intervalDays) || 7);

    // Snapshots
    const [clientDoc, projectDoc] = await Promise.all([
      User.findById(clientId).select('name').lean(),
      Project.findById(projectId).select('title').lean(),
    ]);
    if (!projectDoc) return res.status(404).json({ message: 'Project not found' });
    if (!clientDoc)  return res.status(404).json({ message: 'Client not found' });

    const clientNameSnapshot   = clientDoc.name   || '';
    const projectTitleSnapshot = projectDoc.title  || '';

    // Auto-generate collection entries
    const dates = generateDates(startDate, endDate, interval);
    const generatedCollections = dates.map(d => ({
      collectionDate:       d,
      amount:               Number(amount),
      reason:               reason || '',
      status:               'upcoming',
      isLocked:             false,
      attemptCount:         0,
      clientNameSnapshot,
      projectTitleSnapshot,
    }));

    const plan = await CollectionPlan.create({
      projectId,
      clientId,
      type,
      startDate:    new Date(startDate),
      endDate:      new Date(endDate),
      phaseName:    phaseName || '',
      intervalDays: interval,
      amount:       Number(amount),
      reason:       reason || '',
      workflowItemId: workflowItemId || '',
      clientNameSnapshot,
      projectTitleSnapshot,
      generatedCollections,
    });

    res.status(201).json({ message: 'Collection plan created', plan });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/admin/collection-plans — all plans with populated project + client
adminRouter.get('/', async (req, res) => {
  try {
    const plans = await CollectionPlan.find()
      .populate('projectId', 'title')
      .populate('clientId', 'name email')
      .sort('-createdAt');
    res.json(plans);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/admin/collection-plans/:planId — single plan
adminRouter.get('/:planId', async (req, res) => {
  try {
    const plan = await CollectionPlan.findById(req.params.planId)
      .populate('projectId', 'title totalCost amountPaid')
      .populate('clientId', 'name email phone');
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    res.json(plan);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/admin/collection-plans/:planId/collections/:colId — edit entry (only if not locked)
adminRouter.put('/:planId/collections/:colId', async (req, res) => {
  try {
    const plan = await CollectionPlan.findById(req.params.planId);
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    const col = plan.generatedCollections.id(req.params.colId);
    if (!col) return res.status(404).json({ message: 'Collection entry not found' });
    if (col.isLocked) {
      return res.status(403).json({ message: 'This entry is locked after approval. Reopen it first.' });
    }
    const { collectionDate, amount, reason } = req.body;
    if (collectionDate) col.collectionDate = new Date(collectionDate);
    if (amount)  col.amount = Number(amount);
    if (reason !== undefined) col.reason = reason;
    await plan.save();
    res.json({ message: 'Collection entry updated', plan });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/admin/collection-plans/:planId/collections/:colId/approve
// Auto-creates Payment + increments project.amountPaid (same logic as POST /admin/payments)
adminRouter.patch('/:planId/collections/:colId/approve', async (req, res) => {
  try {
    const plan = await CollectionPlan.findById(req.params.planId);
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    const col = plan.generatedCollections.id(req.params.colId);
    if (!col) return res.status(404).json({ message: 'Collection entry not found' });
    if (col.status === 'approved' && col.isLocked) {
      return res.status(400).json({ message: 'Already approved and locked' });
    }

    // Audit prefix per Q5
    const typeLabel  = plan.type === 'weekly' ? 'Weekly Procurement' : `Phase Collection${plan.phaseName ? ': ' + plan.phaseName : ''}`;
    const desc = `[Collection][${typeLabel}] ${col.reason || plan.reason}`.trim();

    // Auto-create Payment (mirror of POST /admin/payments logic — financial rules unchanged)
    const payment = await Payment.create({
      projectId:            plan.projectId,
      clientId:             plan.clientId,
      amount:               col.amount,
      description:          desc,
      mode:                 'Other',
      category:             'Other',
      type:                 'income',
      status:               'paid',
      paidAt:               new Date(),
      clientNameSnapshot:   col.clientNameSnapshot   || plan.clientNameSnapshot,
      projectTitleSnapshot: col.projectTitleSnapshot || plan.projectTitleSnapshot,
    });

    // Increment project.amountPaid (same rule: income only — never expense)
    await Project.findByIdAndUpdate(plan.projectId, { $inc: { amountPaid: col.amount } });

    // Update collection entry
    col.status      = 'approved';
    col.isLocked    = true;
    col.approvedAt  = new Date();
    col.approvedBy  = req.user?.name || 'Admin';
    col.paymentId   = payment._id;

    await plan.save();
    res.json({ message: 'Collection approved and Payment created', payment, plan });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/admin/collection-plans/:planId/collections/:colId/reject
adminRouter.patch('/:planId/collections/:colId/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    const plan = await CollectionPlan.findById(req.params.planId);
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    const col = plan.generatedCollections.id(req.params.colId);
    if (!col) return res.status(404).json({ message: 'Collection entry not found' });
    if (col.isLocked) return res.status(400).json({ message: 'Cannot reject a locked (approved) entry' });

    col.status          = 'rejected';
    col.rejectedAt      = new Date();
    col.rejectionReason = reason || '';
    await plan.save();
    res.json({ message: 'Collection rejected', plan });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/admin/collection-plans/:planId/collections/:colId/reopen
// Unlocks an approved entry so admin can edit and re-approve (per Q4)
adminRouter.patch('/:planId/collections/:colId/reopen', async (req, res) => {
  try {
    const plan = await CollectionPlan.findById(req.params.planId);
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    const col = plan.generatedCollections.id(req.params.colId);
    if (!col) return res.status(404).json({ message: 'Collection entry not found' });
    if (!col.isLocked) return res.status(400).json({ message: 'Entry is not locked' });

    // Reopen: unlock but keep audit trail. paymentId stays for reference.
    col.status     = 'upcoming';
    col.isLocked   = false;
    col.reopenedAt = new Date();
    col.reopenedBy = req.user?.name || 'Admin';
    await plan.save();
    res.json({ message: 'Collection entry reopened for editing', plan });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/admin/collection-plans/:planId/collections/:colId/need-proof
// Reset to upcoming so client knows to re-upload (Q3 — admin-triggered)
adminRouter.patch('/:planId/collections/:colId/need-proof', async (req, res) => {
  try {
    const plan = await CollectionPlan.findById(req.params.planId);
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    const col = plan.generatedCollections.id(req.params.colId);
    if (!col) return res.status(404).json({ message: 'Collection entry not found' });
    col.status          = 'upcoming';
    col.rejectionReason = req.body.reason || 'Please upload a valid proof of payment.';
    await plan.save();
    res.json({ message: 'Marked as needs proof', plan });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/admin/collection-plans/:planId — cancel plan
adminRouter.delete('/:planId', async (req, res) => {
  try {
    await CollectionPlan.findByIdAndDelete(req.params.planId);
    res.json({ message: 'Collection plan deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ════════════════════════════════════════════════════════════════
//  CLIENT ROUTES
// ════════════════════════════════════════════════════════════════

// GET /api/client/collections — get own collection plans
clientRouter.get('/', async (req, res) => {
  try {
    const plans = await CollectionPlan.find({
      clientId: req.user._id,
      status: 'active',
    }).sort('-createdAt');
    res.json(plans);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/client/collections/:planId/collections/:colId/submit-proof
// Client uploads payment proof — Cloudinary upload + status → pendingApproval
clientRouter.post(
  '/:planId/collections/:colId/submit-proof',
  upload.single('file'),
  async (req, res) => {
    try {
      const plan = await CollectionPlan.findOne({
        _id:      req.params.planId,
        clientId: req.user._id,
      });
      if (!plan) return res.status(404).json({ message: 'Plan not found' });
      const col = plan.generatedCollections.id(req.params.colId);
      if (!col) return res.status(404).json({ message: 'Collection entry not found' });
      if (col.isLocked) return res.status(403).json({ message: 'This collection is already approved' });
      if (!req.file) return res.status(400).json({ message: 'Proof file is required' });

      // Upload to Cloudinary under collection-proofs/
      const proofUrl = await uploadToCloudinary(
        req.file.buffer,
        req.file.mimetype,
        'aarav-interiors/collection-proofs',
        `proof_${req.params.planId}_${req.params.colId}_${Date.now()}`
      );

      // Update submission fields (Q3 — tracks attempt count + lastSubmittedAt)
      col.proofImage       = { url: proofUrl, uploadedAt: new Date(), fileType: req.file.mimetype };
      col.status           = 'pendingApproval';
      col.proofSubmittedAt = new Date();
      col.lastSubmittedAt  = new Date();
      col.attemptCount     = (col.attemptCount || 0) + 1;
      // Reset rejection fields on re-submission
      col.rejectedAt       = undefined;
      col.rejectionReason  = '';

      await plan.save();
      res.json({ message: 'Proof submitted successfully', proofUrl, plan });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = { admin: adminRouter, client: clientRouter };
