// src/utils/logger.ts
import winston from 'winston';
import { env } from '../configs/env';

const format = env.NODE_ENV === 'production'
  ? winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    )
  : winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.printf(({ level, message, timestamp, ...meta }) => {
        const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} [${level}]: ${message}${extra}`;
      })
    );

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format,
  transports: [new winston.transports.Console()],
  exceptionHandlers: [new winston.transports.Console()],
});
