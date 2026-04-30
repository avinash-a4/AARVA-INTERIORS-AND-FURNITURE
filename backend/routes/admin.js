const express    = require('express');
const router     = express.Router();
const nodemailer = require('nodemailer');
const User       = require('../models/User');
const Project    = require('../models/Project');
const Payment    = require('../models/Payment');
const Message    = require('../models/Message');
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
  const { title, clientId, package: pkg, location, startDate, endDate, totalCost } = req.body;
  const project = await Project.create({ title, clientId, package: pkg, location, startDate, endDate, totalCost });
  // Link to client
  await User.findByIdAndUpdate(clientId, { projectId: project._id });
  res.status(201).json(project);
});

// PUT /api/admin/projects/:id
router.put('/projects/:id', async (req, res) => {
  const project = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!project) return res.status(404).json({ message: 'Project not found' });
  res.json(project);
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

    // ── Send email notification (silent — never crashes the API) ──
    try {
      const client = project.clientId;  // already populated above
      if (client?.email) {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        });

        await transporter.sendMail({
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
        });
        console.log(`✓ Design notification sent to ${client.email}`);
      }
    } catch (mailErr) {
      console.warn('Email notification failed (non-fatal):', mailErr.message);
    }

    res.status(201).json({ message: 'Design saved', designs: project.designs });
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
router.get('/payments', async (req, res) => {
  const payments = await Payment.find().populate('clientId', 'name').populate('projectId', 'title');
  res.json(payments);
});

// POST /api/admin/payments
router.post('/payments', async (req, res) => {
  const payment = await Payment.create(req.body);
  res.status(201).json(payment);
});

// PUT /api/admin/payments/:id/mark-paid
router.put('/payments/:id/mark-paid', async (req, res) => {
  const payment = await Payment.findByIdAndUpdate(req.params.id, { status: 'paid', paidAt: new Date() }, { new: true });
  res.json(payment);
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

module.exports = router;
