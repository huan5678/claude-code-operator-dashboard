import { Router } from 'express';
import { readFile, stat, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { homedir } from 'node:os';

// Pulse 資料源 = app 自己管理的 PTY sessions（terminal.list()）。
// 若 channel 有裝 PostToolUse status-writer hook，會再疊加 last_tool / idle 心跳，
// 以 codd_terminal_id（= PTY 注入的 CODD_TERMINAL_ID = session id）比對。
function resolveStatusDir() {
  if (process.env.STATUS_DIR_PATH) return resolve(process.env.STATUS_DIR_PATH);
  if (process.env.STATUS_FILE_PATH) return resolve(dirname(process.env.STATUS_FILE_PATH));
  return resolve(homedir(), '.claude/codd-status');
}

const STALE_AFTER_MS = 60 * 60 * 1000;

async function readSession(file) {
  try {
    const [raw, st] = await Promise.all([readFile(file, 'utf8'), stat(file)]);
    const data = JSON.parse(raw);
    const lastEvent = data.last_event_at ? Date.parse(data.last_event_at) : null;
    const idleSeconds = lastEvent ? Math.max(0, Math.floor((Date.now() - lastEvent) / 1000)) : null;
    const stale = lastEvent ? (Date.now() - lastEvent) > STALE_AFTER_MS : false;
    return { ...data, idle_seconds: idleSeconds, stale, file_mtime: st.mtimeMs };
  } catch {
    return null;
  }
}

// 讀 codd-status 目錄，建 terminalId → hook 心跳 的 map（無目錄就回空 map）
async function readHookMap() {
  const dir = resolveStatusDir();
  if (!existsSync(dir)) return new Map();
  try {
    const files = (await readdir(dir)).filter(f => f.endsWith('.json'));
    const entries = (await Promise.all(files.map(f => readSession(join(dir, f))))).filter(Boolean);
    const map = new Map();
    for (const e of entries) {
      const key = e.codd_terminal_id;
      if (!key) continue;
      // 同一 terminal 多筆取最新（file_mtime 大者）
      const prev = map.get(key);
      if (!prev || (e.file_mtime || 0) > (prev.file_mtime || 0)) map.set(key, e);
    }
    return map;
  } catch {
    return new Map();
  }
}

function runtimeSeconds(s) {
  const start = s.started_at ? Date.parse(s.started_at) : null;
  if (!start) return null;
  const end = s.exited_at ? Date.parse(s.exited_at) : Date.now();
  return Math.max(0, Math.floor((end - start) / 1000));
}

export function statusRouter(terminal) {
  const router = Router();

  router.get('/', async (req, res) => {
    const hookMap = await readHookMap();
    // 只顯示「活著的」session：running 且未被移除
    const sessions = terminal.list().filter(s => s.status === 'running' && !s.removed);
    const items = sessions
      .map(s => {
        const hook = hookMap.get(s.id) || null;
        return {
          session_id: s.id,
          profile_name: s.profile_name,
          status: s.status,
          runtime_seconds: runtimeSeconds(s),
          // 以下來自 hook 心跳（沒裝 hook 就是 null）
          last_tool: hook?.last_tool ?? null,
          idle_seconds: hook?.idle_seconds ?? null,
          tool_count: hook?.tool_count ?? null,
          stale: hook?.stale ?? false,
        };
      })
      // 執行最久的排前面（穩定 session 置頂）
      .sort((a, b) => (b.runtime_seconds ?? 0) - (a.runtime_seconds ?? 0));
    res.json({ available: true, items });
  });

  return router;
}
