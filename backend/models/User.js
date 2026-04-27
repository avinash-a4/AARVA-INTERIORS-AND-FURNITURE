const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:  { type: String, required: true, minlength: 6 },
  phone:     { type: String, default: '' },
  role:      { type: String, enum: ['client','admin'], default: 'client' },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  avatar:    { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// 🔥 FIXED PASSWORD MATCH (handles both hashed + plain)
UserSchema.methods.matchPassword = async function(entered) {
  // If password is NOT hashed (manual insert case)
  if (!this.password.startsWith('$2b$')) {
    return entered === this.password;
  }
  // Normal bcrypt flow
  return bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model('User', UserSchema);