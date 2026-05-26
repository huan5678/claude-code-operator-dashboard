#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { ChannelReader } from '../../server/src/services/channel-reader.js';
import { KanbanRepo } from '../../server/src/services/kanban-repo.js';
import { openDb } from '../../server/src/db/index.js';
import { getAgentSchema } from '../../server/src/services/agent-schema.js';
import { getSkillSchema } from '../../server/src/services/skill-schema.js';

const CHANNEL_PATH = process.env.CHANNEL_PATH;
const DB_PATH = process.env.KANBAN_DB_PATH ?? './apps/server/data/kanban.db';

if (!CHANNEL_PATH) {
  console.error('[codd-mcp] CHANNEL_PATH env is required');
  process.exit(1);
}

const reader = new ChannelReader(CHANNEL_PATH);
const db = openDb(DB_PATH);
const repo = new KanbanRepo(db);

const tools = [
  {
    name: 'list_skills',
    description: '列出此 channel 內全部 skill（含 name / description / triggers）',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => reader.listSkills(),
  },
  {
    name: 'get_skill',
    description: '取得單一 skill 的完整內容（frontmatter + body）',
    inputSchema: {
      type: 'object',
      required: ['slug'],
      properties: { slug: { type: 'string', description: 'skill 資料夾名稱' } },
    },
    handler: async ({ slug }) => {
      const item = await reader.getSkill(slug);
      if (!item) throw new Error(`skill not found: ${slug}`);
      return item;
    },
  },
  {
    name: 'list_agents',
    description: '列出此 channel 內全部 subagent',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => reader.listAgents(),
  },
  {
    name: 'get_agent',
    description: '取得單一 agent 的完整內容',
    inputSchema: {
      type: 'object',
      required: ['slug'],
      properties: { slug: { type: 'string' } },
    },
    handler: async ({ slug }) => {
      const item = await reader.getAgent(slug);
      if (!item) throw new Error(`agent not found: ${slug}`);
      return item;
    },
  },
  {
    name: 'list_tasks',
    description: '列出此 channel 內全部排程 task（含 schedule / enabled）',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => reader.listTasks(),
  },
  {
    name: 'get_task',
    description: '取得單一 task 的完整內容（含 prompt body）',
    inputSchema: {
      type: 'object',
      required: ['slug'],
      properties: { slug: { type: 'string' } },
    },
    handler: async ({ slug }) => {
      const item = await reader.getTask(slug);
      if (!item) throw new Error(`task not found: ${slug}`);
      return item;
    },
  },
  {
    name: 'list_memory_days',
    description: '列出 memory 中所有日期（檔案名稱 YYYY-MM-DD.md）',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: '回傳最近幾天' },
      },
    },
    handler: async ({ limit } = {}) => reader.listMemoryDays({ limit }),
  },
  {
    name: 'get_memory_day',
    description: '取得單一日 memory 的內容',
    inputSchema: {
      type: 'object',
      required: ['date'],
      properties: { date: { type: 'string', description: 'YYYY-MM-DD' } },
    },
    handler: async ({ date }) => {
      const item = await reader.getMemoryDay(date);
      if (!item) throw new Error(`memory not found: ${date}`);
      return item;
    },
  },
  {
    name: 'kanban_list_cards',
    description: 'Kanban 卡片列表，可依 column 過濾',
    inputSchema: {
      type: 'object',
      properties: {
        column: { type: 'string', description: 'Todo / In Progress / Done' },
      },
    },
    handler: async ({ column } = {}) => {
      let columnId = null;
      if (column) {
        const col = repo.listColumns().find(c => c.name === column);
        if (!col) throw new Error(`unknown column: ${column}`);
        columnId = col.id;
      }
      return repo.listCards({ columnId });
    },
  },
  {
    name: 'kanban_get_card',
    description: '取得單一 Kanban 卡片',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'number' } },
    },
    handler: async ({ id }) => {
      const card = repo.getCard(id);
      if (!card) throw new Error(`card not found: ${id}`);
      return card;
    },
  },
  {
    name: 'kanban_create_card',
    description: '新增 Kanban 卡片，預設加在 Todo 欄',
    inputSchema: {
      type: 'object',
      required: ['title'],
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        column: { type: 'string', description: 'Todo / In Progress / Done' },
        tags: { type: 'array', items: { type: 'string' } },
      },
    },
    handler: async ({ title, description, column, tags }) =>
      repo.createCard({ title, description, columnName: column, tags }),
  },
  {
    name: 'kanban_update_card',
    description: '更新卡片：移欄、改標題、改內容、改 tag',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'number' },
        title: { type: 'string' },
        description: { type: 'string' },
        column: { type: 'string' },
        position: { type: 'number' },
        tags: { type: 'array', items: { type: 'string' } },
      },
    },
    handler: async ({ id, column, ...rest }) => {
      const updated = repo.updateCard(id, { ...rest, columnName: column });
      if (!updated) throw new Error(`card not found: ${id}`);
      return updated;
    },
  },
  {
    name: 'kanban_delete_card',
    description: '刪除卡片',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'number' } },
    },
    handler: async ({ id }) => {
      const ok = repo.deleteCard(id);
      if (!ok) throw new Error(`card not found: ${id}`);
      return { ok: true };
    },
  },
  {
    name: 'get_agent_schema',
    description: '取得 Claude Code subagent frontmatter 官方 schema（含每個欄位的 type / enum / required），用來驗證 .claude/agents 的 frontmatter',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => getAgentSchema(),
  },
  {
    name: 'get_skill_schema',
    description: '取得 Claude Code SKILL.md frontmatter 官方 schema，用來驗證 .claude/skills 的 frontmatter',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => getSkillSchema(),
  },
];

const toolMap = new Map(tools.map(t => [t.name, t]));

const server = new Server(
  { name: 'codd-manager', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = toolMap.get(req.params.name);
  if (!tool) {
    return {
      isError: true,
      content: [{ type: 'text', text: `unknown tool: ${req.params.name}` }],
    };
  }
  try {
    const result = await tool.handler(req.params.arguments ?? {});
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: e.message }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
