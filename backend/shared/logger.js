const pino = require('pino');

const logger = pino({
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    ...(process.env.NODE_ENV !== 'production' && {
        transport: {
            target: 'pino/file',
            options: { destination: 1 } // stdout
        },
    }),
    formatters: {
        level(label) {
            return { level: label };
        },
    },
    // Redact sensitive fields that might end up in logs
    redact: ['req.headers.authorization', 'req.headers.cookie', 'password', 'apiToken', 'token'],
    base: { service: 'yahya-api' },
});

module.exports = logger;
