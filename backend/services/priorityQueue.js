const logger = require('../shared/logger');

/**
 * In-memory priority job queue.
 *
 * Jobs are sorted by priority (lower number = higher priority).
 * Plan tiers map to priorities so Enterprise jobs execute before Free jobs.
 *
 * At scale, replace this with BullMQ + Redis with named priority queues.
 */

const PLAN_PRIORITY = {
    Enterprise: 1,
    Pro:        2,
    Basic:      3,
    Free:       4,
};

class PriorityQueue {
    constructor({ concurrency = 2, name = 'default' } = {}) {
        this.name = name;
        this.concurrency = concurrency;
        this._queue = [];           // { priority, job, meta }
        this._running = 0;
        this._results = new Map();  // jobId → { status, result, error }
    }

    /**
     * Enqueue a job function with plan-based priority.
     * @param {string} jobId     Unique job identifier
     * @param {Function} jobFn   Async function to execute
     * @param {string} planTier  Tenant's plan tier (Free/Basic/Pro/Enterprise)
     * @param {Object} [meta]    Optional metadata for logging
     * @returns {string} jobId
     */
    enqueue(jobId, jobFn, planTier = 'Free', meta = {}) {
        const priority = PLAN_PRIORITY[planTier] || PLAN_PRIORITY.Free;

        this._results.set(jobId, { status: 'queued', priority, planTier, enqueuedAt: new Date() });

        this._queue.push({ priority, jobId, jobFn, meta });
        // Sort: lower priority number first (Enterprise=1 runs before Free=4)
        this._queue.sort((a, b) => a.priority - b.priority);

        logger.info({ queue: this.name, jobId, priority, planTier, queueLength: this._queue.length }, 'Job enqueued');

        this._drain();
        return jobId;
    }

    /**
     * Get the current status of a job.
     */
    getStatus(jobId) {
        return this._results.get(jobId) || null;
    }

    /**
     * Process jobs up to concurrency limit.
     */
    _drain() {
        while (this._running < this.concurrency && this._queue.length > 0) {
            const { jobId, jobFn, meta, priority } = this._queue.shift();
            this._running++;

            this._results.set(jobId, {
                ...this._results.get(jobId),
                status: 'processing',
                startedAt: new Date(),
            });

            jobFn()
                .then(result => {
                    this._results.set(jobId, {
                        ...this._results.get(jobId),
                        status: 'completed',
                        result,
                        completedAt: new Date(),
                    });
                    logger.info({ queue: this.name, jobId, priority }, 'Job completed');
                })
                .catch(err => {
                    this._results.set(jobId, {
                        ...this._results.get(jobId),
                        status: 'failed',
                        error: err.message,
                        completedAt: new Date(),
                    });
                    logger.error({ err, queue: this.name, jobId }, 'Job failed');
                })
                .finally(() => {
                    this._running--;
                    this._drain();

                    // Auto-cleanup results after 1 hour
                    setTimeout(() => this._results.delete(jobId), 60 * 60 * 1000);
                });
        }
    }

    /**
     * Current queue stats.
     */
    stats() {
        return {
            name: this.name,
            queued: this._queue.length,
            running: this._running,
            concurrency: this.concurrency,
        };
    }
}

module.exports = { PriorityQueue, PLAN_PRIORITY };
