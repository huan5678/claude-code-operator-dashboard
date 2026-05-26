import Database from 'better-sqlite3';
import { readFileSync, mkdirSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db;

export function openDb(dbPath) {
  if (db) return db;
  const absPath = resolve(dbPath);
  mkdirSync(dirname(absPath), { recursive: true, mode: 0o700 });
  db = new Database(absPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  // DB 含 revoked_sessions / launch_profiles（含 shell command），鎖只給 owner 讀寫
  try { chmodSync(absPath, 0o600); } catch (e) { /* best-effort */ }

  const schema = readFileSync(resolve(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  const columnCount = db.prepare('SELECT COUNT(*) AS c FROM kanban_columns').get().c;
  if (columnCount === 0) {
    const insert = db.prepare('INSERT INTO kanban_columns (id, name, position) VALUES (?, ?, ?)');
    insert.run(1, 'Todo', 0);
    insert.run(2, 'In Progress', 1);
    insert.run(3, 'Done', 2);
  }

  const profileCount = db.prepare('SELECT COUNT(*) AS c FROM launch_profiles').get().c;
  if (profileCount === 0) {
    db.prepare(
      'INSERT INTO launch_profiles (name, command, cwd, env_json) VALUES (?, ?, ?, ?)'
    ).run(
      'claude-station',
      'claude --channels plugin:discord@claude-plugins-official',
      '~/Claude-station',
      '{}'
    );
  }

  return db;
}

export function getDb() {
  if (!db) throw new Error('DB not opened. Call openDb(path) first.');
  return db;
}
