// Claude Code subagent frontmatter schema (2026)
// 來源：https://code.claude.com/docs/en/sub-agents.md

export const AGENT_SCHEMA = {
  name:            { type: 'string',  required: true,  description: '唯一識別碼，小寫 + 連字號' },
  description:     { type: 'string',  required: true,  description: '何時委派任務的單行描述' },
  tools:           { type: 'list',    description: '工具白名單，逗號分隔或陣列' },
  disallowedTools: { type: 'list',    description: '工具黑名單' },
  model:           { type: 'string',  description: '執行模型', suggestions: ['inherit', 'sonnet', 'opus', 'haiku', 'claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'] },
  permissionMode:  { type: 'string',  enum: ['default', 'acceptEdits', 'auto', 'dontAsk', 'bypassPermissions', 'plan'] },
  maxTurns:        { type: 'number',  description: '最大輪次，留空表示無限制' },
  skills:          { type: 'list',    description: '預載 skill 名稱' },
  mcpServers:      { type: 'json',    description: 'MCP server 設定（複雜物件）' },
  hooks:           { type: 'json',    description: 'lifecycle hooks（複雜物件）' },
  memory:          { type: 'string',  enum: ['user', 'project', 'local'] },
  background:      { type: 'boolean', default: false },
  effort:          { type: 'string',  enum: ['low', 'medium', 'high', 'xhigh', 'max'] },
  isolation:       { type: 'string',  enum: ['worktree'] },
  color:           { type: 'string',  enum: ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan'] },
  initialPrompt:   { type: 'string',  description: '首輪自動提示' },
};

export const KNOWN_TOOLS = [
  'Bash', 'BashOutput', 'KillShell',
  'Read', 'Write', 'Edit', 'NotebookEdit',
  'Glob', 'Grep',
  'TodoWrite', 'Task', 'Agent',
  'WebFetch', 'WebSearch',
  'ExitPlanMode',
];

export function validateAgentFrontmatter(fm) {
  const errors = [];
  if (!fm || typeof fm !== 'object') {
    return ['frontmatter 必須是物件'];
  }

  for (const [key, def] of Object.entries(AGENT_SCHEMA)) {
    const val = fm[key];
    if (val === undefined || val === null || val === '') {
      if (def.required) errors.push(`${key} 為必填`);
      continue;
    }
    const e = validateField(key, val, def);
    if (e) errors.push(e);
  }

  for (const key of Object.keys(fm)) {
    if (!AGENT_SCHEMA[key]) {
      errors.push(`未知欄位 ${key}（不在 Claude Code subagent schema）`);
    }
  }

  return errors;
}

function validateField(key, val, def) {
  switch (def.type) {
    case 'string':
      if (typeof val !== 'string') return `${key} 必須是字串`;
      if (def.enum && !def.enum.includes(val)) {
        return `${key} 必須是 ${def.enum.join(' / ')} 其中之一（拿到 ${val}）`;
      }
      return null;
    case 'number':
      if (typeof val !== 'number' || !Number.isFinite(val)) return `${key} 必須是數字`;
      return null;
    case 'boolean':
      if (typeof val !== 'boolean') return `${key} 必須是 true / false`;
      return null;
    case 'list': {
      if (typeof val === 'string') return null;
      if (!Array.isArray(val)) return `${key} 必須是陣列或逗號分隔字串`;
      for (const item of val) {
        if (typeof item !== 'string') return `${key} 內每個元素必須是字串`;
      }
      return null;
    }
    case 'json':
      if (typeof val !== 'object') return `${key} 必須是物件或陣列`;
      return null;
    default:
      return null;
  }
}

export function getAgentSchema() {
  return { schema: AGENT_SCHEMA, knownTools: KNOWN_TOOLS };
}
