import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../../../../.env') });

const defaultPath = resolve(__dirname, '../../data/kanban.db');
const dbPath = process.env.KANBAN_DB_PATH ?? defaultPath;
openDb(dbPath);
console.log(`[migrate] DB initialised at ${resolve(dbPath)}`);
