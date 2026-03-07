const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Payroll = require('./models/Payroll');
const Employee = require('./models/Employee');

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/saas-dashboard';

async function fixPayroll() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB.');

        // Get all payrolls
        const payrolls = await Payroll.find();
        let fixed = 0;

        for (const pr of payrolls) {
            if (!pr.employeeId) {
                // Since our seed generated one payroll per active employee for the current month, 
                // and there's a unique constraint on {employeeId, period}, if employeeId is missing, 
                // the unique constraint might have been bypassed or stored null. Let's just delete the bad ones.
                console.log(`Deleting corrupted payroll ID: ${pr._id}`);
                await Payroll.findByIdAndDelete(pr._id);
                fixed++;
            }
        }

        console.log(`Removed ${fixed} corrupted payroll records.`);

        // Also let's re-run the generator loop since we deleted them
        const { generateMonthlyPayroll } = require('./controllers/payrollController');

        // Mock req/res to call the controller directly
        const req = { body: { period: require('moment')().format('MM-YYYY') } };
        const res = {
            json: (data) => console.log('Generation success:', data.message),
            status: (code) => ({ json: (err) => console.error('Generation Error:', err) })
        };

        console.log("Re-generating accurate payrolls...");
        await generateMonthlyPayroll(req, res);

        console.log("Database patch complete.");
        process.exit(0);

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

fixPayroll();
