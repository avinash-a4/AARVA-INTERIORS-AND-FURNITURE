const express = require('express');
const router  = express.Router();
const EstimatorConfig = require('../models/EstimatorConfig');
const { protect, adminOnly } = require('../middleware/auth');

// GET /api/estimator/config — public
router.get('/config', async (req, res) => {
  try {
    let config = await EstimatorConfig.findOne();
    if (!config) config = await EstimatorConfig.create({});
    res.json(config);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/estimator/config — admin only
router.put('/config', protect, adminOnly, async (req, res) => {
  try {
    let config = await EstimatorConfig.findOne();
    if (!config) config = new EstimatorConfig();
    Object.assign(config, req.body, { updatedAt: new Date() });
    await config.save();
    res.json(config);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
