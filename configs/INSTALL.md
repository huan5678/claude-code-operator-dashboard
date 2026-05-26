# 擴充 Channel — Hooks & Sub-agents 安裝指南

Fancy CODD 提供兩個可選的「注入式擴充」給 channel：

| 模組 | 內容 |
|---|---|
| **hooks** | `PostToolUse` hook，把 session 狀態（last tool / tool count / idle）寫進 `STATUS_FILE_PATH`，讓平台 sidebar widget 顯示 |
| **agents** | sub-agent `frontmatter-doctor`，體檢 channel 內所有 agents / skills 的 frontmatter |
| **mcp** | 把 `codd-manager` MCP server 掛進 channel 的 `.mcp.json`，agent 可呼叫 list_skills / kanban_* / get_agent_schema 等 |

社長用一個 CLI 管整套生命週期，**完全不用手動編 JSON**。

---

## 前置作業

1. 完成根目錄 `.env`（至少 `CHANNEL_PATH=...` 跟 `STATUS_FILE_PATH=...`）
2. `npm install` 過

---

## 4 個 subcommand

### 1. 看狀態 — 不寫任何 file

```bash
npm run channel status
```

輸出範例：
```
channel: /path/to/your-channel

  ✗ hooks    missing
  ✗ agents   missing
  ✗ mcp      missing
```

### 2. 安裝 — 把三個模組部署進 channel

```bash
# 先 dry-run 看會動到什麼
npm run channel install -- --dry-run

# 確認後實裝
npm run channel install
```

行為：
- 已安裝的條目直接 skip（idempotent）
- `.claude/settings.json` 加 `hooks.PostToolUse` 一條，command 帶 `STATUS_FILE_PATH=... node <abs>/configs/hooks/status-writer.js`
- `.claude/agents/frontmatter-doctor.md` 從範本 copy 過去（含 `codd:managed` marker）
- `.mcp.json` 加 `mcpServers.codd-manager`，env 帶你 .env 內的 `KANBAN_DB_PATH`

### 3. 升級 — Fancy CODD 升版後同步 channel

```bash
npm run channel update
```

- 對含 `codd:managed` marker 的 agent 強制覆蓋成最新範本
- Hook command 的絕對路徑同步更新（避免搬 repo 後失效）
- `.mcp.json` 的 codd-manager 條目同步成最新 args / env

### 4. 卸載 — 移除注入內容

```bash
# 軟卸載：移 settings.json / .mcp.json 條目；agent file 保留但 marker 改 unmanaged
npm run channel uninstall

# 硬卸載：連 agent file 也刪
npm run channel uninstall -- --purge
```

---

## 共通 flags

| Flag | 用途 |
|---|---|
| `--channel <path>` | 覆蓋 `.env` 的 `CHANNEL_PATH` |
| `--only hooks,agents,mcp` | 只動其中幾個（逗號分隔） |
| `--dry-run` | 只印 diff 不寫 |
| `--force` | install 時強制覆蓋已存在的 agent file |
| `--purge` | uninstall 時連 agent file 一起刪 |

---

## 範本身份識別

CLI 透過 marker 區分「自己裝的」vs「社長手寫的」：

- **Hooks**: command 內含 `status-writer.js` 字串 + description 含 `[codd:status-writer]`
- **Agents**: file 內含 `<!-- codd:managed source=... -->` 註解
- **MCP**: `mcpServers.codd-manager` key

`uninstall` / `update` 只動帶 marker 的條目。社長手寫的其他 hook / agent / mcp server **不會被誤改**。

---

## Troubleshooting

### `npm run channel status` 顯示 hook 已裝，但 status file 沒更新

1. 確認 Claude Code session 有 reload `.claude/settings.json`（重啟 session 一次）
2. 在 session 內跑任一 tool（例如 `Read`），看 `cat $STATUS_FILE_PATH` 有沒有新 timestamp
3. Hook 命令手測：`echo '{"session_id":"test","tool_name":"Read"}' | STATUS_FILE_PATH=/tmp/codd-test.json node configs/hooks/status-writer.js`，再 `cat /tmp/codd-test.json`

### `@frontmatter-doctor` 找不到 schema

代表 `codd-manager` MCP 沒掛上。確認：
- `npm run channel status` 顯示 `mcp synced`
- Claude Code session 啟動時有 detect 到新 MCP（重啟一次）
- 平台 server 不需要起就好（MCP 是 stdio，直接 spawn）

### CLI 對 `.mcp.json` 報 JSON parse 錯

CLI 不破壞檔案。先看 `.bak` 備份（CLI 寫前會建）：`<channel>/.mcp.json.bak`。

---

## 手動 fallback（不想用 CLI）

如果你想完全手動操作，三件事：

1. **Hook** — 編 `<channel>/.claude/settings.json`，加：
   ```json
   "hooks": {
     "PostToolUse": [{
       "matcher": ".*",
       "command": "STATUS_FILE_PATH=/Users/<you>/.claude/codd-status.json node /abs/path/configs/hooks/status-writer.js"
     }]
   }
   ```

2. **Agent** — `cp configs/agents/frontmatter-doctor.md <channel>/.claude/agents/`

3. **MCP** — 編 `<channel>/.mcp.json`：
   ```json
   {
     "mcpServers": {
       "codd-manager": {
         "command": "node",
         "args": ["/abs/path/apps/mcp/src/index.js"],
         "env": {
           "CHANNEL_PATH": "<channel-abs>",
           "KANBAN_DB_PATH": "<from .env>"
         }
       }
     }
   }
   ```
