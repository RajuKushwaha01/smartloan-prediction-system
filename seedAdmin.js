require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin12345';

async function seedAdmin() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);

        console.log('✅ Connected to MongoDB');

        // Check if admin already exists
        const existingAdmin = await User.findOne({ email: ADMIN_EMAIL });

        if (existingAdmin) {
            if (existingAdmin.role !== 'admin') {
                existingAdmin.role = 'admin';
                await existingAdmin.save();

                console.log(`✅ Existing user promoted to admin: ${ADMIN_EMAIL}`);
            } else {
                console.log(`ℹ️ Admin already exists: ${ADMIN_EMAIL}`);
            }

            await mongoose.connection.close();
            return;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

        // Create admin
        const admin = new User({
    fullName: 'Administrator',
    email: ADMIN_EMAIL,
    password: hashedPassword,
    role: 'admin'
  });

        await admin.save();

        console.log('====================================');
        console.log('✅ ADMIN CREATED SUCCESSFULLY');
        console.log('====================================');
        console.log(`📧 Email: ${ADMIN_EMAIL}`);
        console.log(`🔑 Password: ${ADMIN_PASSWORD}`);
        console.log('====================================');

        await mongoose.connection.close();

    } catch (error) {
        console.error('❌ Error creating admin:', error);
        process.exit(1);
    }
}

seedAdmin();