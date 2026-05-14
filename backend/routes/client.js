const express = require('express');
const router  = express.Router();
const Project = require('../models/Project');
const Payment = require('../models/Payment');
const Message = require('../models/Message');
const Query   = require('../models/Query');
const { protect } = require('../middleware/auth');

router.use(protect);

// GET /api/client/project — get client's own project
router.get('/project', async (req, res) => {
  const user = req.user;
  const project = await Project.findOne({ clientId: user._id });
  if (!project) return res.status(404).json({ message: 'No project assigned' });
  res.json(project);
});

// GET /api/client/payments  — income entries only (expenses are internal, never shown to clients)
router.get('/payments', async (req, res) => {
  const payments = await Payment.find({ clientId: req.user._id, type: 'income' }).sort('-createdAt');
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

// GET /api/client/queries  — fetch own queries
router.get('/queries', async (req, res) => {
  try {
    const queries = await Query.find({ clientId: req.user._id }).sort('-createdAt');
    res.json(queries);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/client/query  — raise a query
router.post('/query', async (req, res) => {
  try {
    const project = await Project.findOne({ clientId: req.user._id });
    const query = await Query.create({
      clientId:  req.user._id,
      projectId: project?._id || null,
      message:   req.body.message,
    });
    res.status(201).json(query);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
