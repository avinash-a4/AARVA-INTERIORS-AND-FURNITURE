const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  clientId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount:    { type: Number, required: true },
  description: { type: String, default: '' },
  status:    { type: String, enum: ['pending','paid'], default: 'pending' },
  mode:      { type: String, enum: ['Cash','UPI','Cheque','Bank Transfer','Other'], default: 'Other' },
  category:  { 
    type: String, 
    enum: ['Plywood', 'Laminate', 'Hardware', 'Carpenter', 'Transport', 'Salaries', 'Other'], 
    default: 'Other' 
  },
  type: {
    type: String,
    enum: ['income', 'expense'],
    default: 'income'
  },
  // Permanent name snapshots — written at creation time so history survives deletion
  clientNameSnapshot:   { type: String, default: '' },
  projectTitleSnapshot: { type: String, default: '' },
  dueDate:   { type: Date },
  paidAt:    { type: Date },
  invoiceUrl:           { type: String,  default: null },
  invoiceNumber:        { type: String,  default: null },
  invoiceGeneratedAt:   { type: Date,    default: null },
  // Set explicitly at creation time — never inferred from description
  invoiceType: {
    type: String,
    enum: ['income', 'expense', 'collection'],
    default: null,
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Payment', PaymentSchema);
