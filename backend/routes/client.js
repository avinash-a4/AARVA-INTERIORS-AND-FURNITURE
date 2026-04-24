const express = require('express');
const router  = express.Router();
const Project = require('../models/Project');
const Payment = require('../models/Payment');
const Message = require('../models/Message');
const { protect } = require('../middleware/auth');

router.use(protect);

// GET /api/client/project — get client's own project
router.get('/project', async (req, res) => {
  const user = req.user;
  const project = await Project.findOne({ clientId: user._id });
  if (!project) return res.status(404).json({ message: 'No project assigned' });
  res.json(project);
});

// GET /api/client/payments
router.get('/payments', async (req, res) => {
  const payments = await Payment.find({ clientId: req.user._id }).sort('-createdAt');
  res.json(payments);
});

// GET /api/client/messages
router.get('/messages', async (req, res) => {
  const project = await Project.findOne({ clientId: req.user._id });
  if (!project) return res.json([]);
  const msgs = await Message.find({ projectId: project._id }).populate('senderId', 'name role').sort('createdAt');
  res.json(msgs);
});

// POST /api/client/messages
router.post('/messages', async (req, res) => {
  const project = await Project.findOne({ clientId: req.user._id });
  if (!project) return res.status(404).json({ message: 'No project found' });
  const msg = await Message.create({ projectId: project._id, senderId: req.user._id, senderRole: 'client', text: req.body.text });
  res.status(201).json(msg);
});

// PUT /api/client/designs/:designId/approve
router.put('/designs/:designId/approve', async (req, res) => {
  const project = await Project.findOne({ clientId: req.user._id });
  if (!project) return res.status(404).json({ message: 'No project' });
  const design = project.designs.id(req.params.designId);
  if (!design) return res.status(404).json({ message: 'Design not found' });
  design.approved = req.body.approved !== false;
  await project.save();
  res.json({ message: 'Design status updated', design });
});

module.exports = router;
