/**
 * Lightweight in-process circuit breaker.
 *
 * States:
 *   CLOSED   → requests pass through normally
 *   OPEN     → requests are rejected immediately (fast-fail)
 *   HALF_OPEN → one probe request is allowed; success → CLOSED, failure → OPEN
 *
 * Usage:
 *   const breaker = new CircuitBreaker({ name: 'ecotrack', failureThreshold: 5 });
 *   const result = await breaker.fire(() => axios.get(url));
 */

const logger = require('./logger');

const STATE = { CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' };

class CircuitBreaker {
    /**
     * @param {object} opts
     * @param {string}  opts.name              - identifier for logging
     * @param {number}  opts.failureThreshold  - consecutive failures before opening (default 5)
     * @param {number}  opts.resetTimeoutMs    - ms to wait before probing (default 30 000)
     * @param {number}  opts.halfOpenMax       - max concurrent probes in HALF_OPEN (default 1)
     */
    constructor({ name = 'circuit', failureThreshold = 5, resetTimeoutMs = 30_000, halfOpenMax = 1 } = {}) {
        this.name = name;
        this.failureThreshold = failureThreshold;
        this.resetTimeoutMs = resetTimeoutMs;
        this.halfOpenMax = halfOpenMax;

        this.state = STATE.CLOSED;
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.halfOpenAttempts = 0;
    }

    /** True when the breaker should allow a request through */
    _shouldAllow() {
        if (this.state === STATE.CLOSED) return true;

        if (this.state === STATE.OPEN) {
            // Check if enough time has passed to transition to HALF_OPEN
            if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
                this.state = STATE.HALF_OPEN;
                this.halfOpenAttempts = 0;
                logger.info({ breaker: this.name }, 'Circuit breaker → HALF_OPEN (probing)');
                return true;
            }
            return false;
        }

        // HALF_OPEN — allow limited probes
        return this.halfOpenAttempts < this.halfOpenMax;
    }

    _onSuccess() {
        if (this.state !== STATE.CLOSED) {
            logger.info({ breaker: this.name }, 'Circuit breaker → CLOSED (recovered)');
        }
        this.failureCount = 0;
        this.state = STATE.CLOSED;
        this.halfOpenAttempts = 0;
    }

    _onFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.state === STATE.HALF_OPEN) {
            this.state = STATE.OPEN;
            logger.warn({ breaker: this.name }, 'Circuit breaker → OPEN (probe failed)');
            return;
        }

        if (this.failureCount >= this.failureThreshold) {
            this.state = STATE.OPEN;
            logger.warn({ breaker: this.name, failureCount: this.failureCount }, 'Circuit breaker → OPEN (threshold reached)');
        }
    }

    /**
     * Execute `fn` through the circuit breaker.
     * @param {Function} fn - async function to execute
     * @returns {Promise<*>}
     * @throws {Error} CIRCUIT_OPEN when breaker is open
     */
    async fire(fn) {
        if (!this._shouldAllow()) {
            const err = new Error(`Circuit breaker "${this.name}" is OPEN — request rejected.`);
            err.code = 'CIRCUIT_OPEN';
            err.isOperational = true;
            err.statusCode = 503;
            throw err;
        }

        if (this.state === STATE.HALF_OPEN) {
            this.halfOpenAttempts++;
        }

        try {
            const result = await fn();
            this._onSuccess();
            return result;
        } catch (error) {
            this._onFailure();
            throw error;
        }
    }

    /** Current state snapshot for health checks / monitoring */
    status() {
        return {
            name: this.name,
            state: this.state,
            failureCount: this.failureCount,
            lastFailureTime: this.lastFailureTime,
        };
    }
}

module.exports = CircuitBreaker;
