const logger = require('../logger');

/**
 * Fire-and-forget an async function with exponential backoff retries.
 *
 * Use this instead of `someAsyncWork().catch(err => logger.error(...))`.
 * It retries transient failures before giving up, without blocking the caller.
 *
 * @param {string}   label    - human-readable name for logging
 * @param {Function} fn       - async function to execute
 * @param {object}   [opts]
 * @param {number}   [opts.retries=2]       - max retry attempts (total tries = retries + 1)
 * @param {number}   [opts.baseDelayMs=500] - initial backoff delay
 * @param {number}   [opts.maxDelayMs=5000] - cap on backoff delay
 */
function fireAndRetry(label, fn, { retries = 2, baseDelayMs = 500, maxDelayMs = 5000 } = {}) {
    (async () => {
        let lastErr;
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                await fn();
                return; // success
            } catch (err) {
                lastErr = err;
                if (attempt < retries) {
                    const delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
                    logger.warn({ label, attempt: attempt + 1, retries, delay }, 'Retrying fire-and-forget task');
                    await new Promise(r => setTimeout(r, delay));
                }
            }
        }
        logger.error({ err: lastErr, label }, 'Fire-and-forget task failed after all retries');
    })();
}

module.exports = { fireAndRetry };
