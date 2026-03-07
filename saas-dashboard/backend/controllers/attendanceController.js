const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const moment = require('moment');

// Helper to convert HH:mm string to minutes from midnight
const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours * 60) + minutes;
};

// Helper to calculate total worked minutes across pointages
const calculateWorkedMinutes = (morningIn, morningOut, eveningIn, eveningOut) => {
    let total = 0;
    if (morningIn && morningOut) {
        total += moment(morningOut).diff(moment(morningIn), 'minutes');
    }
    if (eveningIn && eveningOut) {
        total += moment(eveningOut).diff(moment(eveningIn), 'minutes');
    }
    return total;
};

exports.recordPointage = async (req, res) => {
    try {
        const { employeeId, type, timestamp, date } = req.body; // type: morningIn, morningOut, eveningIn, eveningOut

        const employee = await Employee.findById(employeeId);
        if (!employee) return res.status(404).json({ error: 'Employee not found' });

        const dateStr = date || (timestamp ? moment(timestamp).format('YYYY-MM-DD') : moment().format('YYYY-MM-DD'));

        let attendance = await Attendance.findOne({ employeeId, date: dateStr });
        if (!attendance) {
            attendance = new Attendance({ employeeId, date: dateStr });
        }

        // Register the pointage (Support clearing)
        if (['morningIn', 'morningOut', 'eveningIn', 'eveningOut'].includes(type)) {
            if (!timestamp) {
                attendance[type] = undefined; // Nullify / Clear the slot
            } else {
                attendance[type] = new Date(timestamp);
            }
        } else {
            return res.status(400).json({ error: 'Invalid pointage type' });
        }

        await attendance.save();

        // Trigger background recalculation of metrics for today
        attendance = await exports.calculateDailyMetrics(attendance._id);

        res.json({ message: 'Pointage recorded successfully', attendance });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.calculateDailyMetrics = async (attendanceId) => {
    const attendance = await Attendance.findById(attendanceId).populate('employeeId');
    if (!attendance || !attendance.employeeId) return null;

    const employee = attendance.employeeId;
    const settings = employee.contractSettings || {};

    const requiredMin = settings.dailyRequiredMinutes || 480; // Default 8 hours
    attendance.requiredMinutes = requiredMin;

    // Edge Case: Weekend Work Array
    const workDays = settings.workDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Sunday'];
    const currentDayName = moment(attendance.date).format('dddd');
    const isWeekend = !workDays.includes(currentDayName);

    // 1. Calculate Worked Minutes
    let worked = calculateWorkedMinutes(
        attendance.morningIn, attendance.morningOut,
        attendance.eveningIn, attendance.eveningOut
    );

    // Edge Case: Forgotten Checkout & Partial Attendance
    // If they checked in but didn't check out, we flag the times as incomplete. We won't give them free full hours.
    const forgottenCheckout = (attendance.morningIn && !attendance.morningOut) || (attendance.eveningIn && !attendance.eveningOut);

    attendance.workedMinutes = worked;

    // 2. Calculate Late Minutes based on Morning/Evening Schedule
    let lateMin = 0;
    const gracePeriod = settings.latenessGracePeriodMin || 0;

    if (!isWeekend) {
        if (attendance.morningIn && settings.schedule?.morningStart) {
            const expectedStartMin = timeToMinutes(settings.schedule.morningStart);
            const actualStartMin = timeToMinutes(moment.utc(attendance.morningIn).format('HH:mm'));
            if (actualStartMin > (expectedStartMin + gracePeriod)) {
                lateMin += (actualStartMin - expectedStartMin);
            }
        }

        if (attendance.eveningIn && settings.schedule?.eveningStart) {
            const expectedStartMin = timeToMinutes(settings.schedule.eveningStart);
            const actualStartMin = timeToMinutes(moment.utc(attendance.eveningIn).format('HH:mm'));
            if (actualStartMin > (expectedStartMin + gracePeriod)) {
                lateMin += (actualStartMin - expectedStartMin);
            }
        }
    }
    attendance.lateMinutes = lateMin;

    // 3. Missing vs Overtime
    if (isWeekend) {
        // Weekend rules: All worked time is Overtime. No required/missing minutes.
        attendance.requiredMinutes = 0;
        attendance.missingMinutes = 0;
        attendance.overtimeMinutes = settings.overtimeEnabled !== false ? worked : 0;
    } else {
        if (worked < requiredMin) {
            attendance.missingMinutes = requiredMin - worked;
            attendance.overtimeMinutes = 0;
        } else if (worked > requiredMin && settings.overtimeEnabled !== false) {
            attendance.missingMinutes = 0;
            attendance.overtimeMinutes = worked - requiredMin;
        } else {
            attendance.missingMinutes = 0;
            attendance.overtimeMinutes = 0;
        }
    }

    // 4. Determine Status
    if (attendance.status === 'Approved Leave' || attendance.status === 'Holiday') {
        // Respect explicitly set HR overrides. Keep the status and grant them their hours so they aren't deducted.
        if (worked === 0) attendance.workedMinutes = requiredMin;
        attendance.missingMinutes = 0;
        attendance.lateMinutes = 0;
    } else if (!attendance.morningIn && !attendance.eveningIn) {
        if (isWeekend) {
            // Keep it blank if they didn't work on the weekend, rather than marking as 'Absent'.
            // Actually, if it was automatically generated, we can just delete it, or leave status as blank.
            // Let's set a specific status or just 'Absent' but the Payroll aggregator will ignore 0 missing minutes anyway.
            attendance.status = 'Absent'; // Handled safely by payroll via missingMinutes=0
        } else {
            attendance.status = 'Absent';
        }
    } else if (forgottenCheckout) {
        attendance.status = 'Incomplete';
    } else if (isWeekend && worked > 0) {
        attendance.status = 'Overtime';
    } else if (worked < requiredMin) {
        if (lateMin > 0) attendance.status = 'Late';
        else attendance.status = 'Incomplete';
    } else if (worked >= requiredMin) {
        if (lateMin > 0) attendance.status = 'Completed with Recovery';
        else if (attendance.overtimeMinutes > 0) attendance.status = 'Overtime';
        else attendance.status = 'Present';
    }

    await attendance.save();
    return attendance;
};

exports.getDailyAttendance = async (req, res) => {
    try {
        const { date } = req.query; // YYYY-MM-DD
        const targetDate = date || moment().format('YYYY-MM-DD');

        const records = await Attendance.find({ date: targetDate }).populate('employeeId', 'name department role contractSettings');
        res.json(records);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getEmployeeAttendance = async (req, res) => {
    try {
        const records = await Attendance.find({ employeeId: req.params.id })
            .sort({ date: -1 })
            .limit(60); // Fetch up to 60 days of history
        res.json(records);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateAttendanceRecord = async (req, res) => {
    try {
        const updated = await Attendance.findByIdAndUpdate(req.params.id, req.body, { new: true });

        if (updated) {
            await exports.calculateDailyMetrics(updated._id); // Recalculate if admin edits timestamps
        }

        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
