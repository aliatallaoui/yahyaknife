// Canonical status → Tailwind class map for COD order statuses.
// Import this wherever you need to render a status badge to keep colors consistent.

export const ORDER_STATUS_COLORS = {
    'New':                   'bg-gray-100 text-gray-700 border-gray-200',
    'Call 1':                'bg-indigo-50 text-indigo-700 border-indigo-200',
    'Call 2':                'bg-violet-50 text-violet-700 border-violet-200',
    'Call 3':                'bg-purple-50 text-purple-700 border-purple-200',
    'No Answer':             'bg-slate-50 text-slate-600 border-slate-200',
    'Out of Coverage':       'bg-slate-100 text-slate-500 border-slate-200',
    'Wrong Number':          'bg-rose-50 text-rose-700 border-rose-200',
    'Postponed':             'bg-yellow-50 text-yellow-700 border-yellow-300',
    'Cancelled by Customer': 'bg-gray-50 text-gray-400 border-gray-200',
    'Confirmed':             'bg-blue-50 text-blue-700 border-blue-200',
    'Preparing':             'bg-indigo-50 text-indigo-700 border-indigo-200',
    'Ready for Pickup':      'bg-violet-50 text-violet-700 border-violet-200',
    'Dispatched':            'bg-cyan-50 text-cyan-700 border-cyan-200',
    'Shipped':               'bg-amber-50 text-amber-700 border-amber-200',
    'Out for Delivery':      'bg-orange-50 text-orange-700 border-orange-200',
    'Delivered':             'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Paid':                  'bg-green-50 text-green-700 border-green-200',
    'Refused':               'bg-red-50 text-red-700 border-red-200',
    'Returned':              'bg-rose-50 text-rose-700 border-rose-200',
    'Cancelled':             'bg-gray-50 text-gray-400 border-gray-200 line-through',
};

/** Returns Tailwind classes for a given order status badge. Falls back to neutral gray. */
export function getOrderStatusColor(status) {
    return ORDER_STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600 border-gray-200';
}

// HR Attendance status colors
export const ATTENDANCE_STATUS_COLORS = {
    'Present':                 'bg-emerald-100 text-emerald-800',
    'Completed':               'bg-emerald-100 text-emerald-800',
    'Overtime':                'bg-indigo-100 text-indigo-800',
    'Late':                    'bg-amber-100 text-amber-800',
    'Completed with Recovery': 'bg-blue-100 text-blue-800',
    'Incomplete':              'bg-orange-100 text-orange-800',
    'Absent':                  'bg-rose-100 text-rose-800',
    'Not Marked':              'bg-gray-100 text-gray-500',
};

export function getAttendanceStatusColor(status) {
    return ATTENDANCE_STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600';
}

/** All COD order statuses — single source of truth for dropdowns, filters, etc. */
export const COD_STATUSES = [
    'New', 'Call 1', 'Call 2', 'Call 3', 'No Answer', 'Out of Coverage',
    'Wrong Number', 'Postponed', 'Cancelled by Customer', 'Confirmed',
    'Preparing', 'Ready for Pickup', 'Dispatched', 'Shipped',
    'Out for Delivery', 'Delivered', 'Paid', 'Refused', 'Returned', 'Cancelled',
];

/**
 * Translates an order status string using i18n.
 * Usage: getOrderStatusLabel(t, 'Confirmed') → 'مؤكد' (AR) or 'Confirmed' (EN)
 */
export function getOrderStatusLabel(t, status) {
    return t(`orderStatuses.${status}`, status);
}

/**
 * Translates an attendance status string using i18n.
 */
export function getAttendanceStatusLabel(t, status) {
    return t(`attendanceStatuses.${status}`, status);
}
