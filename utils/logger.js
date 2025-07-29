// logger.js

const winston = require('winston');

// No special imports are needed for the Http transport!

const logger = winston.createLogger({
  level: 'info',
  // The JSON format is perfect for sending as an HTTP body
  format: winston.format.json(),
  defaultMeta: { service: 'user-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),

    // ✅ THE MODERN SOLUTION: Use the built-in HTTP transport
    new winston.transports.Http({
      host: 'localhost',
      port: 5050, // We'll configure Logstash to listen here
      ssl: false // Set to true if you configure SSL in Logstash
    })
  ]
});

// Test log on startup
logger.info('--- APPLICATION BOOT --- This is a test log from startup.');

module.exports = logger;