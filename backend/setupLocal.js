require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Tenant = require('./models/Tenant');
const Role = require('./models/Role');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    // Create tenant
    let tenant = await Tenant.findOne({ name: 'Yahya Knife Workshop' });
    if (!tenant) {
        tenant = await Tenant.create({ name: 'Yahya Knife Workshop', isActive: true });
        console.log('Created tenant:', tenant._id);
    } else {
        console.log('Tenant exists:', tenant._id);
    }

    // Find Owner role
    const role = await Role.findOne({ name: 'Owner / Founder' });
    if (!role) { console.error('Role not found! Run seedRoles.js first.'); process.exit(1); }
    console.log('Role:', role.name);

    // Create admin user with pre-hashed password (bypass pre-save hook)
    const hash = await bcrypt.hash('password123', 10);
    const user = await User.findOneAndUpdate(
        { email: 'admin@yahya.com' },
        { $set: { name: 'Yahya Admin', password: hash, role: role._id, tenant: tenant._id, isActive: true } },
        { returnDocument: 'after', upsert: true }
    );
    console.log('Admin user ready:', user.email, '| tenant:', user.tenant, '| role:', role.name);
    console.log('\nLogin: admin@yahya.com / password123');
    process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
