require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('./models/Employee');
const Attendance = require('./models/Attendance');
const Payroll = require('./models/Payroll');
const attendanceController = require('./controllers/attendanceController');
const payrollController = require('./controllers/payrollController');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/saas-dashboard';

const seedHRSystem = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('📦 Connected to MongoDB');

        // Clean previous
        await Attendance.deleteMany({});
        await Payroll.deleteMany({});

        console.log('🧹 Cleaned existing Attendance & Payroll records');

        // Get an employee to test with
        let emp = await Employee.findOne({ email: 'hr.test@company.com' });

        if (!emp) {
            console.log('No admin found, creating test employee...');
            emp = new Employee({
                name: 'Test HR Worker',
                email: 'hr.test@company.com',
                role: 'Analyst',
                department: 'HR',
                salary: 100000,
                contractSettings: {
                    monthlySalary: 100000,
                    dailyRequiredMinutes: 480, // 8 hours
                    schedule: {
                        morningStart: '08:00', morningEnd: '12:00',
                        eveningStart: '13:00', eveningEnd: '17:00'
                    },
                    overtimeEnabled: true,
                    overtimeRateMultiplier: 1.5,
                    latenessGracePeriodMin: 15,
                    deductionRules: { missedMinutes: true }
                }
            });
            await emp.save();
        } else {
            // Update admin with contract
            emp.contractSettings = {
                monthlySalary: 100000,
                dailyRequiredMinutes: 480, // 8 hours
                schedule: {
                    morningStart: '08:00', morningEnd: '12:00',
                    eveningStart: '13:00', eveningEnd: '17:00'
                },
                overtimeEnabled: true,
                overtimeRateMultiplier: 1.5,
                latenessGracePeriodMin: 15,
                deductionRules: { missedMinutes: true }
            };
            await emp.save();
        }

        console.log(`👨‍💼 Applied 100,000 DZD Contract to ${emp.name}`);

        // Simulate 3 days in March 2026
        // Day 1: Perfect Day (08:00 to 12:00, 13:00 to 17:00 = exactly 480 min)
        const d1 = new Attendance({
            employeeId: emp._id,
            date: '2026-03-01',
            morningIn: new Date('2026-03-01T08:00:00Z'),
            morningOut: new Date('2026-03-01T12:00:00Z'),
            eveningIn: new Date('2026-03-01T13:00:00Z'),
            eveningOut: new Date('2026-03-01T17:00:00Z')
        });
        await d1.save();
        await attendanceController.calculateDailyMetrics(d1._id);

        // Day 2: Late but Overtime Recovery (08:30 to 12:00, 13:00 to 18:00 = 510 min)
        // Late by 30 min (grace is 15). OT = 510 - 480 = 30 min OT
        const d2 = new Attendance({
            employeeId: emp._id,
            date: '2026-03-02',
            morningIn: new Date('2026-03-02T08:30:00Z'),
            morningOut: new Date('2026-03-02T12:00:00Z'),
            eveningIn: new Date('2026-03-02T13:00:00Z'),
            eveningOut: new Date('2026-03-02T18:00:00Z')
        });
        await d2.save();
        await attendanceController.calculateDailyMetrics(d2._id);

        // Day 3: Absent (No pointage)
        const d3 = new Attendance({
            employeeId: emp._id,
            date: '2026-03-03',
        });
        await d3.save();
        await attendanceController.calculateDailyMetrics(d3._id);

        // Day 4: Forgotten Checkout (Missing eveningOut)
        const d4 = new Attendance({
            employeeId: emp._id,
            date: '2026-03-04',
            morningIn: new Date('2026-03-04T08:00:00Z'),
            morningOut: new Date('2026-03-04T12:00:00Z'),
            eveningIn: new Date('2026-03-04T13:00:00Z')
        });
        await d4.save();
        await attendanceController.calculateDailyMetrics(d4._id);

        // Day 5: Weekend Override (Saturday work - all overtime)
        const d5 = new Attendance({
            employeeId: emp._id,
            date: '2026-03-07', // March 7th 2026 is a Saturday
            morningIn: new Date('2026-03-07T09:00:00Z'),
            morningOut: new Date('2026-03-07T13:00:00Z') // 4 hours OT
        });
        await d5.save();
        await attendanceController.calculateDailyMetrics(d5._id);

        console.log('📅 Simulated 5 days of Attendance pointage (Perfect, Late+OT, Absent, Forgot Checkout, Weekend Override)');

        // Show Metrics
        const a1 = await Attendance.findById(d1._id);
        const a2 = await Attendance.findById(d2._id);
        const a3 = await Attendance.findById(d3._id);
        const a4 = await Attendance.findById(d4._id);
        const a5 = await Attendance.findById(d5._id);
        console.log(`\n--- Day 1 (Perfect) --- \nWorked: ${a1.workedMinutes}m, Late: ${a1.lateMinutes}m, OT: ${a1.overtimeMinutes}m, Status: ${a1.status}`);
        console.log(`--- Day 2 (Late+OT) --- \nWorked: ${a2.workedMinutes}m, Late: ${a2.lateMinutes}m, OT: ${a2.overtimeMinutes}m, Status: ${a2.status}`);
        console.log(`--- Day 3 (Absent)  --- \nWorked: ${a3.workedMinutes}m, Status: ${a3.status}`);
        console.log(`--- Day 4 (Bailout) --- \nWorked: ${a4.workedMinutes}m, Status: ${a4.status}`);
        console.log(`--- Day 5 (Weekend) --- \nWorked: ${a5.workedMinutes}m, OT: ${a5.overtimeMinutes}m, Req: ${a5.requiredMinutes}m, Status: ${a5.status}`);

        // Generate Payroll for 03-2026
        console.log('\ns Processing Monthly Payroll Engine for 03-2026...');

        // Mocking Request/Response objects for controller
        const req = { body: { period: '03-2026' } };
        const res = {
            json: (data) => {
                const targetDoc = data.data.find(r => r.employeeId.toString() === emp._id.toString() || (r.employeeId && r.employeeId.name === 'Test HR Worker'));
                if (targetDoc) {
                    console.log(`\n✓ TARGET HR WORKER RESULTS: Final Salary DZD = ${targetDoc.finalPayableSalary.toLocaleString()}`);
                    console.log(`  - Base: 100,000 | Overtime Added: +${targetDoc.overtimeAdditions.toLocaleString()}`);
                    console.log(`  - Absence Deductions: -${targetDoc.absenceDeductions.toLocaleString()}`);
                    console.log(`  - Missing Time Deductions: -${targetDoc.missingTimeDeductions.toLocaleString()}`);
                } else {
                    console.log('Test HR Worker not found in payload', data.data.length);
                }
            },
            status: (code) => ({ json: (err) => console.error(err) })
        };

        await payrollController.generateMonthlyPayroll(req, res);

    } catch (err) {
        console.error('❌ Seeding Error:', err);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
};

seedHRSystem();
