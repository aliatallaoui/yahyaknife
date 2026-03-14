/**
 * Lightweight date utilities — replaces moment.js (285KB).
 * Uses native Intl and Date APIs.
 */

const SHORT_MONTH_DAY = { month: 'short', day: '2-digit' };
const SHORT_MONTH_DAY_YEAR = { month: 'short', day: '2-digit', year: 'numeric' };
const LONG_MONTH_YEAR = { month: 'long', year: 'numeric' };
const FULL_DATE = { month: 'long', day: 'numeric', year: 'numeric' };
const FULL_DATE_TIME = { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' };
const SHORT_DATETIME = { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
const TIME_HM = { hour: '2-digit', minute: '2-digit', hour12: false };
const WEEKDAY_SHORT_DATE = { weekday: 'long', month: 'short', day: 'numeric' };

const fmt = (d = new Date(), opts) => new Intl.DateTimeFormat('en-US', opts).format(new Date(d));

/** "Mar 05" */
export const fmtShortDate = (d) => fmt(d, SHORT_MONTH_DAY);

/** "Mar 05, 2026" */
export const fmtMediumDate = (d) => fmt(d, SHORT_MONTH_DAY_YEAR);

/** "March 5th, 2026" — approximation: "March 05, 2026" */
export const fmtFullDate = (d) => fmt(d, FULL_DATE);

/** "March 05, 2026, 2:30 PM" */
export const fmtFullDateTime = (d) => fmt(d, FULL_DATE_TIME);

/** "Mar 05, 14:30" */
export const fmtShortDateTime = (d) => fmt(d, SHORT_DATETIME);

/** "March 2026" */
export const fmtMonthYear = (d) => fmt(d, LONG_MONTH_YEAR);

/** "14:30" */
export const fmtTime = (d) => fmt(d, TIME_HM);

/** "Thursday, Mar 5" */
export const fmtWeekdayDate = (d) => fmt(d, WEEKDAY_SHORT_DATE);

/** "YYYY-MM-DD" */
export const toISODate = (d = new Date()) => {
    const dt = new Date(d);
    return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
};

/** "HH:mm" */
export const toHHMM = (d = new Date()) => {
    const dt = new Date(d);
    return String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
};

/** "MM-YYYY" */
export const toMMYYYY = (d = new Date()) => {
    const dt = new Date(d);
    return String(dt.getMonth() + 1).padStart(2, '0') + '-' + dt.getFullYear();
};

/** Parse "MM-YYYY" string to Date */
export const parseMMYYYY = (str) => {
    const [mm, yyyy] = str.split('-');
    return new Date(Number(yyyy), Number(mm) - 1, 1);
};

/** Relative time: "3 hours ago", "2 days ago", etc. */
export const fromNow = (d) => {
    const now = Date.now();
    const then = new Date(d).getTime();
    const diffMs = now - then;
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (years > 0) return years === 1 ? 'a year ago' : `${years} years ago`;
    if (months > 0) return months === 1 ? 'a month ago' : `${months} months ago`;
    if (days > 0) return days === 1 ? 'a day ago' : `${days} days ago`;
    if (hours > 0) return hours === 1 ? 'an hour ago' : `${hours} hours ago`;
    if (minutes > 0) return minutes === 1 ? 'a minute ago' : `${minutes} minutes ago`;
    return 'just now';
};

/** Relative time without "ago": "3 hours", "2 days" */
export const fromNowShort = (d) => {
    const now = Date.now();
    const then = new Date(d).getTime();
    const diffMs = now - then;
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (years > 0) return years === 1 ? 'a year' : `${years} years`;
    if (months > 0) return months === 1 ? 'a month' : `${months} months`;
    if (days > 0) return days === 1 ? 'a day' : `${days} days`;
    if (hours > 0) return hours === 1 ? 'an hour' : `${hours} hours`;
    if (minutes > 0) return minutes === 1 ? 'a minute' : `${minutes} minutes`;
    return 'a few seconds';
};

/** Diff in days between two dates */
export const diffDays = (a, b) => {
    return Math.floor((new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24));
};

/** Diff in hours between two dates */
export const diffHours = (a, b) => {
    return Math.floor((new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60));
};

/** Subtract days/months from date, return new Date */
export const subtract = (d, amount, unit) => {
    const dt = new Date(d);
    if (unit === 'days') dt.setDate(dt.getDate() - amount);
    else if (unit === 'months') dt.setMonth(dt.getMonth() - amount);
    else if (unit === 'years') dt.setFullYear(dt.getFullYear() - amount);
    return dt;
};

/** Start of month */
export const startOfMonth = (d = new Date()) => {
    const dt = new Date(d);
    dt.setDate(1);
    dt.setHours(0, 0, 0, 0);
    return dt;
};

/** End of month */
export const endOfMonth = (d = new Date()) => {
    const dt = new Date(d);
    dt.setMonth(dt.getMonth() + 1, 0);
    dt.setHours(23, 59, 59, 999);
    return dt;
};

/** Check if two dates are in the same month */
export const isSameMonth = (a, b) => {
    const da = new Date(a);
    const db = new Date(b);
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth();
};

/** Check if date a is after date b */
export const isAfter = (a, b) => new Date(a).getTime() > new Date(b).getTime();

/** Duration formatting from milliseconds: "2h 15m" or "3d 5h" */
export const formatDuration = (ms) => {
    const totalMinutes = Math.floor(ms / 60000);
    const totalHours = Math.floor(totalMinutes / 60);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const minutes = totalMinutes % 60;

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
};
