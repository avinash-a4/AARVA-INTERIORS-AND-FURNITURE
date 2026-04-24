const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  clientId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount:    { type: Number, required: true },
  description: { type: String, default: '' },
  status:    { type: String, enum: ['pending','paid'], default: 'pending' },
  mode:      { type: String, enum: ['Cash','UPI','Cheque','Bank Transfer','Other'], default: 'Other' },
  dueDate:   { type: Date },
  paidAt:    { type: Date },
  invoiceUrl: { type: String },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Payment', PaymentSchema);
