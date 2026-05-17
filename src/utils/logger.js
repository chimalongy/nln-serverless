const winston = require('winston');
const { config } = require('../config');

/**
 * Create a Winston logger instance
 * Logs to console with structured format
 */
const logger = winston.createLogger({
  level: config.system.logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'nln-serverless',
    environment: config.nodeEnv,
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, service, ...metadata }) => {
          let msg = `${timestamp} [${level}] [${service}]: ${message}`;
          if (Object.keys(metadata).length > 0 && metadata.environment) {
            const meta = Object.entries(metadata)
              .filter(([key]) => !['environment', 'service'].includes(key))
              .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
              .join(' ');
            if (meta) msg += ` | ${meta}`;
          }
          return msg;
        })
      ),
    }),
  ],
});

/**
 * Create a child logger with additional metadata
 * @param {Object} meta - Additional metadata to include in all logs
 * @returns {winston.Logger}
 */
function createChildLogger(meta) {
  return logger.child(meta);
}

module.exports = {
  logger,
  createChildLogger,
};
