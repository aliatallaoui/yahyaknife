const mongoose = require('mongoose');
const logger = require('../shared/logger');
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
        const tenant = req.user.tenant;
        const { employeeId, type, timestamp, date } = req.body;

        const employee = await Employee.findOne({ _id: employeeId, tenant, deletedAt: null });
        if (!employee) return res.status(404).json({ error: 'Employee not found' });

        const dateStr = date || (timestamp ? moment(timestamp).format('YYYY-MM-DD') : moment().format('YYYY-MM-DD'));

        let attendance = await Attendance.findOne({ tenant, employeeId, date: dateStr });
        if (!attendance) {
            attendance = new Attendance({ tenant, employeeId, date: dateStr });
        }

        if (['morningIn', 'morningOut', 'eveningIn', 'eveningOut'].includes(type)) {
            if (!timestamp) {
                attendance[type] = undefined;
            } else {
                // Reject duplicate clock-in/out — require explicit clear first
                if (attendance[type]) {
                    return res.status(409).json({ error: `${type} is already recorded for this date. Clear it first before re-recording.` });
                }
                attendance[type] = new Date(timestamp);
            }
        } else {
            return res.status(400).json({ error: 'Invalid pointage type' });
        }

        await attendance.save();
        attendance = await exports.calculateDailyMetrics(attendance._id);

        res.json({ message: 'Pointage recorded successfully', attendance });
    } catch (err) {
        logger.error({ err }, 'Error recording pointage');
        res.status(500).json({ error: 'Server error' });
    }
};

exports.calculateDailyMetrics = async (attendanceId) => {
    const attendance = await Attendance.findById(attendanceId).populate('employeeId');
    if (!attendance || !attendance.employeeId) return null;

    const employee = attendance.employeeId;
    const settings = employee.contractSettings || {};

    const requiredMin = settings.dailyRequiredMinutes || 480;
    attendance.requiredMinutes = requiredMin;

    const workDays = settings.workDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Sunday'];
    const currentDayName = moment(attendance.date).format('dddd');
    const isWeekend = !workDays.includes(currentDayName);

    let worked = calculateWorkedMinutes(
        attendance.morningIn, attendance.morningOut,
        attendance.eveningIn, attendance.eveningOut
    );

    const forgottenCheckout = (attendance.morningIn && !attendance.morningOut) || (attendance.eveningIn && !attendance.eveningOut);
    attendance.workedMinutes = worked;

    let lateMin = 0;
    const gracePeriod = settings.latenessGracePeriodMin || 0;

    if (!isWeekend) {
        if (attendance.morningIn && settings.schedule?.morningStart) {
            const expectedStartMin = timeToMinutes(settings.schedule.morningStart);
            const actualStartMin = timeToMinutes(moment.utc(attendance.morningIn).format('HH:mm'));
            if (actualStartMin > (expectedStartMin + gracePeriod)) {
                lateMin += (actualStartMin - expectedStartMin - gracePeriod);
            }
        }
        if (attendance.eveningIn && settings.schedule?.eveningStart) {
            const expectedStartMin = timeToMinutes(settings.schedule.eveningStart);
            const actualStartMin = timeToMinutes(moment.utc(attendance.eveningIn).format('HH:mm'));
            if (actualStartMin > (expectedStartMin + gracePeriod)) {
                lateMin += (actualStartMin - expectedStartMin - gracePeriod);
            }
        }
    }
    attendance.lateMinutes = lateMin;

    if (isWeekend) {
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

    if (attendance.status === 'Approved Leave' || attendance.status === 'Holiday') {
        if (worked === 0) attendance.workedMinutes = requiredMin;
        attendance.missingMinutes = 0;
        attendance.lateMinutes = 0;
    } else if (!attendance.morningIn && !attendance.eveningIn) {
        attendance.status = 'Absent';
    } else if (forgottenCheckout) {
        attendance.status = 'Incomplete';
        // Ensure salary deduction for missing time is recorded regardless of config
        if (!isWeekend) {
            attendance.missingMinutes = Math.max(0, requiredMin - worked);
        }
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
        const tenant = req.user.tenant;
        const { date } = req.query;
        const targetDate = date || moment().format('YYYY-MM-DD');

        const records = await Attendance.find({ tenant, date: targetDate })
            .populate({ path: 'employeeId', match: { deletedAt: null }, select: 'name department role contractSettings' })
            .lean();
        res.json(records.filter(r => r.employeeId));
    } catch (err) {
        logger.error({ err }, 'Error fetching daily attendance');
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getEmployeeAttendance = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ error: 'Invalid employee ID' });
        // Verify employee is not soft-deleted before returning history
        const emp = await require('../models/Employee').findOne({ _id: req.params.id, tenant: req.user.tenant, deletedAt: null }).select('_id').lean();
        if (!emp) return res.status(404).json({ error: 'Employee not found' });
        const records = await Attendance.find({ tenant: req.user.tenant, employeeId: req.params.id })
            .sort({ date: -1 })
            .limit(60)
            .lean();
        res.json(records);
    } catch (err) {
        logger.error({ err }, 'Error fetching employee attendance');
        res.status(500).json({ error: 'Server error' });
    }
};

exports.updateAttendanceRecord = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ error: 'Invalid attendance record ID' });
        const { morningIn, morningOut, eveningIn, eveningOut, status } = req.body;
        const updated = await Attendance.findOneAndUpdate(
            { _id: req.params.id, tenant: req.user.tenant },
            { morningIn, morningOut, eveningIn, eveningOut, status },
            { new: true }
        );

        if (!updated) return res.status(404).json({ error: 'Attendance record not found' });
        await exports.calculateDailyMetrics(updated._id);

        res.json(updated);
    } catch (err) {
        logger.error({ err }, 'Error updating attendance record');
        res.status(500).json({ error: 'Server error' });
    }
};
