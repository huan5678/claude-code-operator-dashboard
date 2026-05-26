#!/usr/bin/env node
// Claude Code PostToolUse hook → 寫 session status 到 STATUS_DIR_PATH/<session_id>.json
//
// 安裝：透過 `npm run channel install` 自動加進 channel 的 .claude/settings.json
// 容錯：無論 stdin 是什麼都不能 throw，否則會擋住 Claude Code 的 tool call

import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { homedir } from 'node:os';

// 優先：STATUS_DIR_PATH（multi-session）
// 回退：dirname(STATUS_FILE_PATH)（Increment 03 舊行為）
// 預設：~/.claude/codd-status/
function resolveStatusDir() {
  if (process.env.STATUS_DIR_PATH) return resolve(process.env.STATUS_DIR_PATH);
  if (process.env.STATUS_FILE_PATH) return resolve(dirname(process.env.STATUS_FILE_PATH));
  return resolve(homedir(), '.claude/codd-status');
}

const STATUS_DIR = resolveStatusDir();
const CHANNEL_PATH = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const TERMINAL_ID = process.env.CODD_TERMINAL_ID || null;

function readStdin() {
  try {
    const buf = readFileSync(0);
    return buf.toString('utf8');
  } catch { return ''; }
}

function safeParse(s) {
  if (!s || !s.trim()) return {};
  try { return JSON.parse(s); } catch { return {}; }
}

function sessionFile(sessionId) {
  return join(STATUS_DIR, `${sessionId}.json`);
}

function loadPrev(file) {
  if (!existsSync(file)) return {};
  try { return JSON.parse(readFileSync(file, 'utf8')); }
  catch { return {}; }
}

function writeAtomic(file, data) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp.${process.pid}`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  renameSync(tmp, file);
}

try {
  const payload = safeParse(readStdin());
  const sessionId = payload.session_id || 'unknown';
  const file = sessionFile(sessionId);
  const prev = loadPrev(file);

  const next = {
    session_id: sessionId,
    last_event_at: new Date().toISOString(),
    last_tool: payload.tool_name || payload.toolName || prev.last_tool || null,
    tool_count: (prev.tool_count || 0) + 1,
    channel_path: CHANNEL_PATH,
    codd_terminal_id: TERMINAL_ID,
  };

  writeAtomic(file, next);
} catch {
  // hook 絕不能擋住 session
}

process.exit(0);
