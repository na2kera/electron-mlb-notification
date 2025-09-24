import fs from 'node:fs';
import path from 'node:path';

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');

function ensureLogFile() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }

  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, '', 'utf-8');
  }
}

ensureLogFile();

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const writeStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

function log(level: LogLevel, message: string, meta?: unknown) {
  const timestamp = new Date().toISOString();
  const entry = JSON.stringify({ timestamp, level, message, meta });

  writeStream.write(`${entry}\n`);

  switch (level) {
    case 'debug':
      console.debug(message, meta);
      break;
    case 'info':
      console.info(message, meta);
      break;
    case 'warn':
      console.warn(message, meta);
      break;
    case 'error':
      console.error(message, meta);
      break;
    default:
      console.log(message, meta);
  }
}

export const logger = {
  debug: (message: string, meta?: unknown) => log('debug', message, meta),
  info: (message: string, meta?: unknown) => log('info', message, meta),
  warn: (message: string, meta?: unknown) => log('warn', message, meta),
  error: (message: string, meta?: unknown) => log('error', message, meta),
};
