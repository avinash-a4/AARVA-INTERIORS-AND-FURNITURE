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
    exterior:      { type: Number, default: 40000  },
    'extra-bed':   { type: Number, default: 80000  },
    'master-wardrobe':      { type: Number, default: 85000 },
    'master-king-bed-6x6':  { type: Number, default: 55000 },
    'master-queen-bed-5x6': { type: Number, default: 45000 },
    'master-tv-unit':       { type: Number, default: 35000 },
    'master-study-unit':    { type: Number, default: 25000 },
    'master-side-table':    { type: Number, default: 10000 },
    'kids-wardrobe':        { type: Number, default: 70000 },
    'kids-bed-3x6':         { type: Number, default: 35000 },
    'kids-study-unit':      { type: Number, default: 20000 },
    'kids-tv-unit':         { type: Number, default: 25000 },
    'kids-side-table':      { type: Number, default: 8000  },
    'living-tv-unit':       { type: Number, default: 45000 },
    partition:              { type: Number, default: 30000 },
    'console-unit':         { type: Number, default: 25000 },
    'wall-highlighters':    { type: Number, default: 20000 },
    'main-door':            { type: Number, default: 40000 },
    'shoe-box':             { type: Number, default: 18000 },
    'laundry-unit':         { type: Number, default: 22000 },
    'storage-unit':         { type: Number, default: 35000 },
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
