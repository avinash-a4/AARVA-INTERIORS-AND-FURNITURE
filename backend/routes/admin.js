const express    = require('express');
const router     = express.Router();
const nodemailer = require('nodemailer');
const User       = require('../models/User');
const Project    = require('../models/Project');
const Payment    = require('../models/Payment');
const Message    = require('../models/Message');
const Query      = require('../models/Query');
const { protect, adminOnly } = require('../middleware/auth');
const upload     = require('../middleware/upload');
const cloudinary = require('../config/cloudinary');

// All admin routes require auth + admin role
router.use(protect, adminOnly);

// GET /api/admin/clients
router.get('/clients', async (req, res) => {
  const clients = await User.find({ role: 'client' }).select('-password').populate('projectId');
  res.json(clients);
});

// POST /api/admin/clients  — handled in auth/register

// GET /api/admin/projects
router.get('/projects', async (req, res) => {
  const projects = await Project.find().populate('clientId', 'name email phone');
  res.json(projects);
});

// POST /api/admin/projects
router.post('/projects', async (req, res) => {
  try {
    const { title, clientId, package: pkg, location, startDate, endDate, totalCost } = req.body;
    const project = await Project.create({
      title,
      clientId,
      package:       pkg      || 'Standard',
      location:      location || '',
      startDate:     startDate || null,
      endDate:       endDate   || null,
      totalCost:     Number(totalCost) || 0,
      // Strict zero-state defaults — never inherit demo data
      progress:      0,
      amountPaid:    0,
      designs:       [],
      timeline:      [],
      recentUpdates: [],
    });
    // Link to client
    await User.findByIdAndUpdate(clientId, { projectId: project._id });
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/admin/projects/:id
router.put('/projects/:id', async (req, res) => {
  try {
    const { timeline, ...rest } = req.body;
    const update = { ...rest };

    // If timeline is being updated, also push recentUpdates entries
    if (Array.isArray(timeline)) {
      update.timeline = timeline;
      const updates = timeline
        .filter(t => t.status === 'done' || t.status === 'in-progress')
        .map(t => ({
          message: `${t.phase} marked as ${t.status === 'done' ? 'Completed' : 'In Progress'}${t.note ? ': ' + t.note : ''}`,
          date: new Date(),
        }));
      if (updates.length) {
        update.$push = { recentUpdates: { $each: updates } };
      }
    }

    const project = await Project.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/admin/clients/:id  (cascade-deletes linked project + its queries)
router.delete('/clients/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Client not found' });

    if (user.projectId) {
      // Delete queries tied to this project before deleting the project
      await Query.deleteMany({ projectId: user.projectId });
      await Project.findByIdAndDelete(user.projectId);
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Client deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/admin/projects/:id  (clears projectId on linked client, deletes related queries)
router.delete('/projects/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    // 1. Delete all queries tied to this project (hard delete — orphan queries serve no purpose)
    await Query.deleteMany({ projectId: req.params.id });

    // 2. Unlink the project from the client (DO NOT delete payments — financial record must be preserved)
    await User.findByIdAndUpdate(project.clientId, { $unset: { projectId: '' } });

    // 3. Delete the project
    await Project.findByIdAndDelete(req.params.id);

    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/admin/projects/:id/timeline
router.post('/projects/:id/timeline', async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ message: 'Project not found' });
  project.timeline.push(req.body);
  await project.save();
  res.json(project.timeline);
});

// POST /api/admin/projects/:id/designs  (save Google Drive URL + notify client)
router.post('/projects/:id/designs', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id).populate('clientId', 'name email');
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const { name, type, url } = req.body;
    if (!url) return res.status(400).json({ message: 'Design URL is required' });

    project.designs.push({ name, type, url, approved: false, uploadedAt: new Date() });
    await project.save();

    res.status(201).json({ message: 'Design saved', designs: project.designs });

    // ── Send email notification (silent — never crashes the API) ──
    try {
      const client = project.clientId;  // already populated above
      if (client?.email) {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        });

        transporter.sendMail({
          from:    `"AARAV Interiors" <${process.env.EMAIL_USER}>`,
          to:      client.email,
          subject: `New Design Added — ${project.title}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1a1a1a">
              <h2 style="color:#C6A969">AARAV Interiors</h2>
              <p>Hi <strong>${client.name}</strong>,</p>
              <p>A new design has been added to your project <strong>${project.title}</strong>.</p>
              <table style="border-collapse:collapse;margin:1rem 0">
                <tr><td style="padding:6px 12px 6px 0;color:#666">Design</td><td><strong>${name || 'Untitled'}</strong></td></tr>
                <tr><td style="padding:6px 12px 6px 0;color:#666">Type</td><td>${type || '—'}</td></tr>
              </table>
              <a href="${url}" target="_blank"
                style="display:inline-block;padding:12px 24px;background:#C6A969;color:#fff;
                       text-decoration:none;border-radius:6px;font-weight:bold;margin:0.5rem 0">
                View Design
              </a>
              <p style="margin-top:1.5rem;color:#555">Please log in to your client dashboard to review and approve the design.</p>
              <hr style="border:none;border-top:1px solid #eee;margin:1.5rem 0" />
              <p style="color:#999;font-size:0.85rem">— AARAV Interiors &nbsp;&bull;&nbsp; Luxury Interior Designers</p>
            </div>`,
        }).catch(err => console.warn(err));
      }
    } catch (mailErr) {
      console.warn('Email notification failed (non-fatal):', mailErr.message);
    }
  } catch (err) {
    console.error('Save design error:', err);
    res.status(500).json({ message: err.message || 'Failed to save design' });
  }
});

// POST /api/admin/projects/:id/designs/upload  (real file upload via multer + Cloudinary)
router.post('/projects/:id/designs/upload', upload.single('file'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (!req.file) return res.status(400).json({ message: 'No file provided' });

    // Explicitly set resource_type per file:
    // PDFs → 'raw'   so Cloudinary stores under /raw/upload/ with correct Content-Type
    // Images → 'image' for normal image processing and delivery
    const isPDF = req.file.mimetype === 'application/pdf';

    const cloudinaryUrl = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder:        'aarav-interiors/designs',
          resource_type: isPDF ? 'raw' : 'image',
          public_id:     `project_${req.params.id}_${Date.now()}`,
          format:        isPDF ? 'pdf' : undefined,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result.secure_url);
        }
      );
      stream.end(req.file.buffer);
    });

    // Save design entry into project
    const designEntry = {
      name:       req.body.name  || req.file.originalname,
      type:       req.body.type  || '3D Render',
      url:        cloudinaryUrl,
      approved:   false,
      uploadedAt: new Date(),
    };
    project.designs.push(designEntry);
    await project.save();

    res.status(201).json({ message: 'Design uploaded successfully', design: designEntry, designs: project.designs });
  } catch (err) {
    console.error('Design upload error:', err);
    res.status(500).json({ message: err.message || 'Upload failed' });
  }
});

// GET /api/admin/payments
// Audit table — ALL payments are always returned regardless of project/client existence.
// $lookup is LEFT JOIN by nature; missing project/client produces empty array → $arrayElemAt
// returns null → frontend shows "Project Deleted" / "Client Deleted" gracefully.
router.get('/payments', async (req, res) => {
  try {
    const payments = await Payment.aggregate([
      // ── Step 1: left-join projects (empty array when project deleted) ────────
      {
        $lookup: {
          from: 'projects',
          let: { pid: '$projectId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$pid'] } } },
            { $project: { _id: 1, title: 1 } }
          ],
          as: 'project'
        },
      },
      // ── Step 2: left-join users (empty array when client deleted) ────────────
      {
        $lookup: {
          from: 'users',
          let: { cid: '$clientId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$cid'] } } },
            { $project: { _id: 1, name: 1 } }
          ],
          as: 'client'
        },
      },
      // ── Step 3: promote first element (null when lookup found nothing) ───────
      {
        $addFields: {
          projectId: { $arrayElemAt: ['$project', 0] },
          clientId:  { $arrayElemAt: ['$client',  0] },
        },
      },
      // ── Step 4: drop raw lookup arrays only — keep ALL payment fields ────────
      // Exclusion-only $project avoids the mixed include+exclude pitfall.
      // Every field on the Payment document (amount, mode, category, TYPE, etc.)
      // passes through automatically — no field is accidentally omitted.
      {
        $project: { project: 0, client: 0 },
      },
      // ── Step 5: newest first ─────────────────────────────────────────────────
      { $sort: { createdAt: -1 } },
    ]);

    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// POST /api/admin/payments  — records payment + conditionally increments project.amountPaid
router.post('/payments', async (req, res) => {
  try {
    const { projectId, clientId, amount, mode, category, type, description } = req.body;
    if (!projectId || !clientId || !amount) {
      return res.status(400).json({ message: 'projectId, clientId and amount are required' });
    }

    const paymentType = (type === 'expense') ? 'expense' : 'income'; // safe fallback

    const payment = await Payment.create({
      projectId, clientId,
      amount:      Number(amount),
      mode:        mode || 'Other',
      category:    category || 'Other',
      type:        paymentType,
      description: description || '',
      status:      'paid',
      paidAt:      new Date(),
    });

    // Only increment amountPaid for INCOME — expenses must never affect client balance
    let project = null;
    if (paymentType === 'income') {
      project = await Project.findByIdAndUpdate(
        projectId,
        { $inc: { amountPaid: Number(amount) } },
        { new: true }
      );
    } else {
      project = await Project.findById(projectId);
    }

    res.status(201).json({ payment, project });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/admin/payments/:id/mark-paid
router.put('/payments/:id/mark-paid', async (req, res) => {
  const payment = await Payment.findByIdAndUpdate(
    req.params.id,
    { status: 'paid', paidAt: new Date() },
    { new: true }
  );
  res.json(payment);
});

// GET /api/admin/queries
// Queries are hard-deleted on project delete; this filter is a safety net for any legacy orphans.
router.get('/queries', async (req, res) => {
  const queries = await Query.find()
    .populate('clientId', 'name email')
    .populate('projectId', 'title')  // resolves to null if project was deleted
    .sort('-createdAt');

  // Strip any orphaned queries whose project no longer exists
  const filtered = queries.filter(q => q.projectId !== null);
  res.json(filtered);
});

// PATCH /api/admin/queries/:id/resolve
router.patch('/queries/:id/resolve', async (req, res) => {
  const query = await Query.findByIdAndUpdate(
    req.params.id,
    { status: 'resolved' },
    { new: true }
  );
  if (!query) return res.status(404).json({ message: 'Query not found' });
  res.json(query);
});

// GET /api/admin/messages/:projectId
router.get('/messages/:projectId', async (req, res) => {
  const msgs = await Message.find({ projectId: req.params.projectId }).populate('senderId', 'name role').sort('createdAt');
  res.json(msgs);
});

// POST /api/admin/messages
router.post('/messages', async (req, res) => {
  const msg = await Message.create({ ...req.body, senderId: req.user._id, senderRole: 'admin' });
  res.status(201).json(msg);
});

// GET /api/admin/payments/client/:clientId
router.get('/payments/client/:clientId', async (req, res) => {
  try {
    const payments = await Payment.find({ clientId: req.params.clientId }).sort('-createdAt');
    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/admin/projects/:id/financials
// Returns live income, expense, profit, and balance derived from the Payment collection (SSOT).
router.get('/projects/:id/financials', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const result = await Payment.aggregate([
      { $match: { projectId: new (require('mongoose').Types.ObjectId)(req.params.id) } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } }
    ]);

    const totalIncome   = result.find(r => r._id === 'income')?.total  || 0;
    const totalExpenses = result.find(r => r._id === 'expense')?.total || 0;
    const profit        = totalIncome - totalExpenses;
    const balanceDue    = Math.max(0, (project.totalCost || 0) - totalIncome);

    res.json({ totalIncome, totalExpenses, profit, balanceDue, totalCost: project.totalCost || 0 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
