// Claude Code Skill (SKILL.md) frontmatter schema
// 來源：https://code.claude.com/docs/en/skills
// 對未知欄位採「warn」而非 fail（相容社長現有的 triggers_zh / triggers_en）

export const SKILL_SCHEMA = {
  name:                       { type: 'string',  description: '命令識別名，小寫英數 + 連字號，預設為目錄名' },
  description:                { type: 'string',  description: 'Claude 何時自動加載的描述（極建議填，限 1536 字元含 when_to_use）' },
  when_to_use:                { type: 'string',  description: '補充 description 的觸發提示' },
  'argument-hint':            { type: 'string',  description: '自動完成時的參數提示，例如 [issue-number]' },
  arguments:                  { type: 'list',    description: '命名位置參數（陣列或空格分隔字串）' },
  'disable-model-invocation': { type: 'boolean', default: false, description: '禁止 Claude 自動加載（僅手動 /skill 呼叫）' },
  'user-invocable':           { type: 'boolean', default: true,  description: '是否顯示在 / 菜單' },
  'allowed-tools':            { type: 'list',    description: '預核可工具白名單（如 Bash(git *) Read Grep）' },
  model:                      { type: 'string',  description: '覆蓋 session 的執行模型', suggestions: ['inherit', 'sonnet', 'opus', 'haiku', 'claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'] },
  effort:                     { type: 'string',  enum: ['low', 'medium', 'high', 'xhigh', 'max'] },
  context:                    { type: 'string',  enum: ['inline', 'fork'], default: 'inline', description: 'fork = 在子 agent 內執行' },
  agent:                      { type: 'string',  description: 'context=fork 時指定 sub-agent 類型（如 general-purpose / Explore / Plan）' },
  hooks:                      { type: 'json',    description: 'Skill 生命週期 hooks（物件）' },
  paths:                      { type: 'list',    description: 'glob 模式限制自動激活檔案範圍' },
  shell:                      { type: 'string',  enum: ['bash', 'powershell'], default: 'bash', description: '`!command` 執行環境' },
};

// Skill 內 `allowed-tools` 接受工具名稱跟 Claude Code 內建一致
export const KNOWN_TOOLS = [
  'Bash', 'BashOutput', 'KillShell',
  'Read', 'Write', 'Edit', 'NotebookEdit',
  'Glob', 'Grep',
  'TodoWrite', 'Task', 'Agent',
  'WebFetch', 'WebSearch',
  'ExitPlanMode',
];

export function validateSkillFrontmatter(fm) {
  const errors = [];
  const warnings = [];

  if (!fm || typeof fm !== 'object') {
    return { errors: ['frontmatter 必須是物件'], warnings: [] };
  }

  for (const [key, def] of Object.entries(SKILL_SCHEMA)) {
    const val = fm[key];
    if (val === undefined || val === null || val === '') continue;
    const e = validateField(key, val, def);
    if (e) errors.push(e);
  }

  for (const key of Object.keys(fm)) {
    if (!SKILL_SCHEMA[key]) {
      warnings.push(`未知欄位 ${key}（不在 Claude Code 官方 SKILL.md 規格，但已保留）`);
    }
  }

  return { errors, warnings };
}

function validateField(key, val, def) {
  switch (def.type) {
    case 'string':
      if (typeof val !== 'string') return `${key} 必須是字串`;
      if (def.enum && !def.enum.includes(val)) {
        return `${key} 必須是 ${def.enum.join(' / ')} 其中之一（拿到 ${val}）`;
      }
      return null;
    case 'boolean':
      if (typeof val !== 'boolean') return `${key} 必須是 true / false`;
      return null;
    case 'list': {
      if (typeof val === 'string') return null;
      if (!Array.isArray(val)) return `${key} 必須是陣列或字串`;
      for (const item of val) {
        if (typeof item !== 'string') return `${key} 內每個元素必須是字串`;
      }
      return null;
    }
    case 'json':
      if (typeof val !== 'object') return `${key} 必須是物件`;
      return null;
    default:
      return null;
  }
}

export function getSkillSchema() {
  return { schema: SKILL_SCHEMA, knownTools: KNOWN_TOOLS };
}
