/**
 * Local Dev Server Runner with In-Memory MongoDB & Auto-Seeding
 * Persists demo credentials:
 *   Admin: admin@aarav.in / admin123
 *   Client: client@aarav.in / client123
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// Ensure dotenv is loaded
require('dotenv').config({ path: './.env' });

async function main() {
  console.log('--- Starting MongoDB Memory Server ---');
  const mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  console.log('MongoDB Memory Server running at:', mongoUri);

  // Set env vars for the backend
  process.env.MONGO_URI = mongoUri;
  process.env.PORT = '5000';
  process.env.JWT_SECRET = 'aarav_luxury_interiors_secret_key_2026';
  process.env.RESEND_API_KEY = 're_dummy_resend_key_for_testing';

  // Seed on connection
  mongoose.connection.once('open', async () => {
    console.log('--- Seeding Demo Database ---');
    try {
      const User = require('./models/User');
      const Project = require('./models/Project');

      // Create Admin
      const admin = new User({
        name: 'Royal Admin',
        email: 'admin@aarav.in',
        password: 'admin123', // Will be hashed by pre-save hook
        role: 'admin'
      });
      await admin.save();
      console.log('✅ Admin seeded: admin@aarav.in / admin123');

      // Create Client
      const client = new User({
        name: 'Aarav Client',
        email: 'client@aarav.in',
        password: 'client123', // Will be hashed by pre-save hook
        role: 'client'
      });
      await client.save();
      console.log('✅ Client seeded: client@aarav.in / client123');

      // Create Project
      const project = new Project({
        title: 'Luxury Penthouse',
        clientId: client._id,
        status: 'execution',
        progress: 45,
        package: 'Premium',
        totalCost: 1500000,
        amountPaid: 250000,
        location: 'Jubilee Hills, Hyderabad',
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-12-31')
      });
      await project.save();
      console.log('✅ Project seeded: "Luxury Penthouse"');

      // Associate project with client
      client.projectId = project._id;
      await client.save();
      console.log('✅ Client linked to project!');
      console.log('--- Database Seeding Complete ---');
    } catch (err) {
      console.error('❌ Seeding failed:', err.message);
    }
  });

  // Load backend server
  console.log('--- Loading Backend Server ---');
  require('./server.js');
}

main().catch(err => {
  console.error('Local runner main loop error:', err);
});
