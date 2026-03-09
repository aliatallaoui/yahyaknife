require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('./models/Employee');
const Attendance = require('./models/Attendance');
const Payroll = require('./models/Payroll');
const attendanceController = require('./controllers/attendanceController');
const moment = require('moment');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/saas-dashboard';

const seedAttendanceData = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('📦 Connected to MongoDB');

        // Target exact month for seeding
        const TARGET_YEAR = 2026;
        const TARGET_MONTH = 2; // March (0-indexed)
        const daysInMonth = moment({ year: TARGET_YEAR, month: TARGET_MONTH }).daysInMonth();

        // Target the specific Arabic employees
        const namesToTarget = ['أحمد', 'ريان', 'حيدر', 'جابر', 'يحيى', 'الشيخ', 'أيمن', 'آدم'];
        const employees = await Employee.find({ name: { $in: namesToTarget } });

        if (employees.length === 0) {
            console.error('❌ No target employees found. Make sure addSpecialEmployees.js was run.');
            process.exit(1);
        }

        console.log(`👨‍💼 Found ${employees.length} employees to seed data for March 2026.`);

        // Clear existing attendance and payroll for this month to prevent duplicates
        const startDate = moment({ year: TARGET_YEAR, month: TARGET_MONTH, date: 1 }).format('YYYY-MM-DD');
        const endDate = moment({ year: TARGET_YEAR, month: TARGET_MONTH, date: daysInMonth }).format('YYYY-MM-DD');

        await Attendance.deleteMany({
            employeeId: { $in: employees.map(e => e._id) },
            date: { $gte: startDate, $lte: endDate }
        });

        await Payroll.deleteMany({
            employeeId: { $in: employees.map(e => e._id) },
            period: '03-2026'
        });

        console.log('🧹 Cleaned existing March 2026 Attendance/Payroll for selected employees.');

        let recordsCreated = 0;

        // Loop through every day of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = moment({ year: TARGET_YEAR, month: TARGET_MONTH, date: day });
            const dateStr = currentDate.format('YYYY-MM-DD');
            const dayOfWeek = currentDate.day(); // 0 is Sunday, 6 is Saturday

            // Loop through each employee to create a realistic day
            for (let emp of employees) {
                // If it's Friday (5) or Saturday (6), usually it's a weekend.
                // The contractSettings.workDays handles the exact logic during calculation, 
                // but we will simulate mostly "No pointage" on Friday/Saturday, except for rare overtime.
                const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;

                // Randomize scenarios
                const rand = Math.random();
                let morningIn, morningOut, eveningIn, eveningOut;

                if (isWeekend) {
                    // 90% chance they don't work the weekend. 10% chance they do some overtime on Saturday.
                    if (dayOfWeek === 6 && rand > 0.9) {
                        morningIn = new Date(`${dateStr}T09:00:00Z`);
                        morningOut = new Date(`${dateStr}T13:00:00Z`);
                    } else {
                        // Skip creating an attendance record, they aren't here and shouldn't be.
                        continue;
                    }
                } else {
                    // Regular Work Day Scenarios
                    if (rand < 0.05) {
                        // 5% chance: Absent (No record created, but we need an empty record to trigger "Absent" status calculation, or controller handles it)
                        // Actually, our system calculates Absence if there's an empty record or via the cron job. We'll explicitly create an empty record to trigger the calc.
                    } else if (rand < 0.15) {
                        // 10% chance: Late Arrival (Arrives at 08:45 instead of 08:00)
                        morningIn = new Date(`${dateStr}T08:45:00Z`);
                        morningOut = new Date(`${dateStr}T12:00:00Z`);
                        eveningIn = new Date(`${dateStr}T13:00:00Z`);
                        eveningOut = new Date(`${dateStr}T17:00:00Z`);
                    } else if (rand < 0.25) {
                        // 10% chance: Missing check-out (Forgot to punch out in the evening)
                        morningIn = new Date(`${dateStr}T08:00:00Z`);
                        morningOut = new Date(`${dateStr}T12:00:00Z`);
                        eveningIn = new Date(`${dateStr}T13:00:00Z`);
                    } else if (rand < 0.35) {
                        // 10% chance: Overtime (Stays until 19:00)
                        morningIn = new Date(`${dateStr}T08:00:00Z`);
                        morningOut = new Date(`${dateStr}T12:00:00Z`);
                        eveningIn = new Date(`${dateStr}T13:00:00Z`);
                        eveningOut = new Date(`${dateStr}T19:00:00Z`);
                    } else {
                        // 65% chance: Perfect Day
                        // Small variations in punch-in time to look realistic (07:55 - 08:05)
                        const minsOffsetIn = Math.floor(Math.random() * 10) - 5;
                        const minsOffsetOut = Math.floor(Math.random() * 10) - 5;

                        morningIn = moment(`${dateStr}T08:00:00Z`).add(minsOffsetIn, 'minutes').toDate();
                        morningOut = new Date(`${dateStr}T12:00:00Z`);
                        eveningIn = new Date(`${dateStr}T13:00:00Z`);
                        eveningOut = moment(`${dateStr}T17:00:00Z`).add(minsOffsetOut, 'minutes').toDate();
                    }
                }

                // Create the record
                const attRecord = new Attendance({
                    employeeId: emp._id,
                    date: dateStr,
                    morningIn,
                    morningOut,
                    eveningIn,
                    eveningOut
                });

                await attRecord.save();
                // Trigger the exact mathematics calculation hook inside our controller so statuses and minutes are populated
                await attendanceController.calculateDailyMetrics(attRecord._id);
                recordsCreated++;
            }
        }

        console.log(`\n🎉 Successfully inserted ${recordsCreated} randomized daily pointages for March 2026.`);

        // Now run the Payroll Generator explicitly for this period so the Dashboard has data
        console.log('\n⚙️ Running Payroll Engine for 03-2026 to lock in stats...');

        const payrollController = require('./controllers/payrollController');

        // Mock express req/res
        const req = { body: { period: '03-2026' } };
        const res = {
            json: (data) => {
                console.log(`✅ Payroll generation complete. Total slips generated: ${data.data?.length || 0}`);
            },
            status: (code) => ({ json: (err) => console.error('Payroll Gen Error:', err) })
        };

        await payrollController.generateMonthlyPayroll(req, res);

        console.log('\n🚀 ALL DUMMY DATA INJECTED SUCCESSFULLY. Check the HR Dashboard and HR Reports.');
        process.exit(0);

    } catch (err) {
        console.error('❌ Seeding Error:', err);
        process.exit(1);
    }
};

seedAttendanceData();
