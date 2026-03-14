// Canonical status → Tailwind class map for COD order statuses.
// Import this wherever you need to render a status badge to keep colors consistent.

export const ORDER_STATUS_COLORS = {
    'New':                   'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600',
    'Call 1':                'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-700',
    'Call 2':                'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-700',
    'Call 3':                'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700',
    'No Answer':             'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-600',
    'Out of Coverage':       'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-600',
    'Wrong Number':          'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-700',
    'Postponed':             'bg-yellow-50 text-yellow-700 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700',
    'Cancelled by Customer': 'bg-gray-50 text-gray-400 border-gray-200 dark:bg-gray-800/60 dark:text-gray-500 dark:border-gray-600',
    'Confirmed':             'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-600',
    'Preparing':             'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-700',
    'Ready for Pickup':      'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-700',
    'Dispatched':            'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-300 dark:border-cyan-700',
    'Shipped':               'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700',
    'Out for Delivery':      'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700',
    'Delivered':             'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700',
    'Paid':                  'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700',
    'Refused':               'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700',
    'Returned':              'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-700',
    'Cancelled':             'bg-gray-50 text-gray-400 border-gray-200 line-through dark:bg-gray-800/60 dark:text-gray-500 dark:border-gray-600',
};

/** Returns Tailwind classes for a given order status badge. Falls back to neutral gray. */
export function getOrderStatusColor(status) {
    return ORDER_STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600';
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
 * Valid status transitions — mirrors backend order.statemachine.js.
 * Used to filter dropdown options so users can only select valid next statuses.
 */
export const VALID_TRANSITIONS = {
    'New':                  ['Call 1', 'Call 2', 'Call 3', 'No Answer', 'Wrong Number', 'Postponed', 'Out of Coverage', 'Confirmed', 'Cancelled', 'Cancelled by Customer'],
    'Call 1':               ['Call 2', 'No Answer', 'Wrong Number', 'Postponed', 'Confirmed', 'Cancelled', 'Cancelled by Customer'],
    'Call 2':               ['Call 3', 'No Answer', 'Wrong Number', 'Postponed', 'Confirmed', 'Cancelled', 'Cancelled by Customer'],
    'Call 3':               ['No Answer', 'Wrong Number', 'Postponed', 'Confirmed', 'Cancelled', 'Cancelled by Customer'],
    'No Answer':            ['Call 1', 'Call 2', 'Call 3', 'Postponed', 'Confirmed', 'Cancelled', 'Cancelled by Customer'],
    'Postponed':            ['Call 1', 'Call 2', 'Call 3', 'Confirmed', 'Cancelled', 'Cancelled by Customer'],
    'Wrong Number':         ['Confirmed', 'Cancelled', 'Cancelled by Customer'],
    'Out of Coverage':      ['Confirmed', 'Cancelled', 'Cancelled by Customer'],
    'Cancelled by Customer':['Confirmed'],
    'Confirmed':            ['Preparing', 'Cancelled'],
    'Preparing':            ['Ready for Pickup', 'Cancelled'],
    'Ready for Pickup':     ['Cancelled'],
};

/** Returns valid next statuses for the given current status. */
export function getAllowedTransitions(currentStatus) {
    return VALID_TRANSITIONS[currentStatus] || [];
}

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
