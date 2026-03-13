/**
 * SSRF guard — rejects URLs pointing to internal/cloud metadata hosts.
 * Used by webhook controller + webhook delivery service.
 *
 * @param {string} urlStr
 * @returns {string|null} error message or null if valid
 */
function validateWebhookUrl(urlStr) {
    let parsed;
    try { parsed = new URL(urlStr); } catch {
        return 'Invalid URL format';
    }
    if (parsed.protocol !== 'https:') {
        return 'Webhook URL must use HTTPS';
    }
    const h = parsed.hostname;
    const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254', '::1', '[::1]'];
    if (
        blocked.includes(h) ||
        h.startsWith('10.') ||
        h.startsWith('192.168.') ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
        h.endsWith('.local') ||
        h.endsWith('.internal')
    ) {
        return 'Webhook URL must point to a public host';
    }
    return null;
}

module.exports = { validateWebhookUrl };
