const mongoose = require('mongoose');

const EstimatorConfigSchema = new mongoose.Schema({
  bhkPrices: {
    '1BHK': { type: Number, default: 350000  },
    '2BHK': { type: Number, default: 650000  },
    '3BHK': { type: Number, default: 950000  },
    '4BHK': { type: Number, default: 1400000 },
    '5+BHK':{ type: Number, default: 2000000 },
  },
  roomPrices: {
    kitchen:       { type: Number, default: 120000 },
    living:        { type: Number, default: 150000 },
    'master-bed':  { type: Number, default: 100000 },
    wardrobe:      { type: Number, default: 65000  },
    'false-ceiling':{ type: Number, default: 55000 },
    'kids-bed':    { type: Number, default: 80000  },
    'extra-bed':   { type: Number, default: 80000  },
  },
  addonPrices: {
    'modular-kitchen':   { type: Number, default: 85000  },
    'wardrobes-upgrade': { type: Number, default: 70000  },
    'smart-lighting':    { type: Number, default: 65000  },
    'custom-furniture':  { type: Number, default: 120000 },
  },
  packageMultipliers: {
    Basic:    { type: Number, default: 1   },
    Standard: { type: Number, default: 1.5 },
    Premium:  { type: Number, default: 2   },
  },
  updatedAt: { type: Date, default: Date.now },
}, { collection: 'estimator_config' });

module.exports = mongoose.model('EstimatorConfig', EstimatorConfigSchema);
