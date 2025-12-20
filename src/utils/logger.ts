import pino from 'pino';

const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const base = {
  app: 'sentinel-grc',
  env: process.env.NODE_ENV || 'development'
};

export const logger = pino({
  level,
  base,
  redact: ['req.headers.authorization', 'req.body.password'],
  timestamp: pino.stdTimeFunctions.isoTime
});

export type Logger = typeof logger;
