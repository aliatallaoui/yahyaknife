const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const dashboardRoutes = require('./routes/dashboard');
const financeRoutes = require('./routes/finance');
const salesRoutes = require('./routes/sales');
const inventoryRoutes = require('./routes/inventory');
const customerRoutes = require('./routes/customerRoutes');
const hrRoutes = require('./routes/hr');
const projectRoutes = require('./routes/projects');
const productionRoutes = require('./routes/production');
const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const courierRoutes = require('./routes/couriers');
const intelligenceRoutes = require('./routes/intelligenceRoutes');
const { initJobs } = require('./cron/scheduler');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/saas-dashboard';

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/couriers', courierRoutes);
app.use('/api/intelligence', intelligenceRoutes);

// Connect to MongoDB
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('Connected to MongoDB');
        initJobs(); // Start background workers
    })
    .catch(err => console.error('MongoDB connection error:', err.message));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
