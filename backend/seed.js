const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Dashboard = require('./models/DashboardData');

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/saas-dashboard';

mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB connected for seeding'))
    .catch(err => console.error('MongoDB connection error:', err));

const seedData = async () => {
    try {
        await Dashboard.deleteMany({});

        // Generate heatmap data to form a diamond shape
        const heatmapData = [];
        const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        const hours = ['9.00', '10.00', '11.00', '12.00', '13.00', '14.00'];

        // Function to calculate a mock value for the diamond shape centered at Wed (3), 11.00 (hour idx 2)
        for (let d = 0; d < days.length; d++) {
            for (let h = 0; h < hours.length; h++) {
                const distDay = Math.abs(d - 3); // Distance from Wednesday
                const distHour = Math.abs(h - 2); // Distance from 11.00
                const distance = distDay + distHour;

                let val = 0;
                if (distance === 0) val = 100; // Center (darkest)
                else if (distance === 1) val = 80;
                else if (distance === 2) val = 50;
                else if (distance === 3) val = 20;
                else val = 5; // Background noise

                heatmapData.push({ day: days[d], hour: hours[h], value: val });
            }
        }

        const data = new Dashboard({
            kpis: {
                totalSales: { value: 1298724, trend: 12.3, dateRange: "04 Dec 2025 - 31 Dec 2025" },
                inventoryValues: { value: 237829, trend: -12.3, warning: "Need Rebalance Inventory" },
                totalOrders: { value: 14867, trend: 12.3 }
            },
            channels: [
                { name: 'Amazon', value: 99592, percentage: 40, color: '#1A73E8' },
                { name: 'Alibaba', value: 74684, percentage: 30, color: '#4285F4' },
                { name: 'Tokopedia', value: 49796, percentage: 20, color: '#8AB4F8' },
                { name: 'Shopee', value: 24898, percentage: 10, color: '#D2E3FC' }
            ],
            monthlyExpenses: [
                { month: 'Jan', baseline: 120000, actual: 110000, assets: 200000, salary: 11000, monthly: 4000 },
                { month: 'Feb', baseline: 130000, actual: 140000, assets: 250000, salary: 11500, monthly: 4200 },
                { month: 'Mar', baseline: 110000, actual: 160000, assets: 300000, salary: 12000, monthly: 4500 },
                { month: 'Apr', baseline: 180000, actual: 210000, assets: 350000, salary: 12500, monthly: 4800 },
                { month: 'May', baseline: 250000, actual: 428937, assets: 410921, salary: 12728, monthly: 5288 }, // From spec
                { month: 'Jun', baseline: 200000, actual: 380000, assets: 390000, salary: 12600, monthly: 5100 },
                { month: 'Jul', baseline: 150000, actual: 300000, assets: 310000, salary: 12000, monthly: 4900 },
                { month: 'Aug', baseline: 140000, actual: 250000, assets: 280000, salary: 11800, monthly: 4700 },
                { month: 'Sep', baseline: 160000, actual: 280000, assets: 290000, salary: 11900, monthly: 4800 },
                { month: 'Oct', baseline: 130000, actual: 200000, assets: 250000, salary: 11500, monthly: 4500 },
                { month: 'Nov', baseline: 120000, actual: 180000, assets: 240000, salary: 11300, monthly: 4300 },
                { month: 'Dec', baseline: 110000, actual: 150000, assets: 210000, salary: 11000, monthly: 4100 }
            ],
            customerFunnel: [
                { step: 1, percentage: 98.9 },
                { step: 2, percentage: 86.1 },
                { step: 3, percentage: 72.8 },
                { step: 4, percentage: 64.8 },
                { step: 5, percentage: 54.2 }
            ],
            orderFrequency: heatmapData
        });

        await data.save();
        console.log('Database seeded successfully!');
        process.exit();
    } catch (err) {
        console.error('Error seeding data:', err);
        process.exit(1);
    }
};

seedData();
