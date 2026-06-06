const express = require('express');
const router  = express.Router();
const EstimatorConfig = require('../models/EstimatorConfig');
const { protect, adminOnly } = require('../middleware/auth');

function _completeEstimatorConfig(config) {
  const defaults = new EstimatorConfig().toObject();
  const current = config.toObject ? config.toObject() : config;

  return {
    ...current,
    bhkPrices: { ...defaults.bhkPrices, ...(current.bhkPrices || {}) },
    roomPrices: { ...defaults.roomPrices, ...(current.roomPrices || {}) },
    addonPrices: { ...defaults.addonPrices, ...(current.addonPrices || {}) },
    packageMultipliers: { ...defaults.packageMultipliers, ...(current.packageMultipliers || {}) },
  };
}

// GET /api/estimator/config — public
router.get('/config', async (req, res) => {
  try {
    let config = await EstimatorConfig.findOne();
    if (!config) config = await EstimatorConfig.create({});
    res.json(_completeEstimatorConfig(config));
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
    res.json(_completeEstimatorConfig(config));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
