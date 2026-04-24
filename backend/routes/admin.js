const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const Project = require('../models/Project');
const Payment = require('../models/Payment');
const Message = require('../models/Message');
const { protect, adminOnly } = require('../middleware/auth');

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

// POST /api/admin/projects/:id/designs  (upload URL)
router.post('/projects/:id/designs', async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ message: 'Project not found' });
  project.designs.push(req.body);
  await project.save();
  res.json(project.designs);
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
