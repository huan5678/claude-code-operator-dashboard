<script setup>
import { ref, watch, computed, onMounted } from 'vue';
import MarkdownView from './MarkdownView.vue';
import { api } from '../api.js';

const props = defineProps({
  resource: { type: Object, required: true },
});
const emit = defineEmits(['save']);

const fm = ref({});
const body = ref('');
const editMode = ref(false);
const advancedJson = ref(false);
const jsonText = ref('');
const saving = ref(false);
const errors = ref([]);
const schema = ref(null);
const knownTools = ref([]);

onMounted(async () => {
  const data = await api.getAgentSchema();
  schema.value = data.schema;
  knownTools.value = data.knownTools;
});

watch(() => props.resource, (r) => {
  fm.value = { ...(r.frontmatter ?? {}) };
  body.value = r.body ?? '';
  jsonText.value = JSON.stringify(r.frontmatter ?? {}, null, 2);
  editMode.value = false;
  advancedJson.value = false;
  errors.value = [];
}, { immediate: true });

const toolsAsList = computed({
  get: () => normaliseList(fm.value.tools),
  set: (v) => { fm.value.tools = v.length ? v : undefined; },
});

const disallowedAsList = computed({
  get: () => normaliseList(fm.value.disallowedTools),
  set: (v) => { fm.value.disallowedTools = v.length ? v : undefined; },
});

const skillsAsList = computed({
  get: () => normaliseList(fm.value.skills),
  set: (v) => { fm.value.skills = v.length ? v : undefined; },
});

function normaliseList(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return String(val).split(',').map(s => s.trim()).filter(Boolean);
}

function toggleTool(tool) {
  const list = toolsAsList.value.slice();
  const idx = list.indexOf(tool);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(tool);
  toolsAsList.value = list;
}

function isToolSelected(tool) {
  return toolsAsList.value.includes(tool);
}

const COLOR_OPTIONS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan'];
const COLOR_HEX = {
  red: '#ef5b5b', blue: '#5b8def', green: '#4ec9b0', yellow: '#e6c84e',
  purple: '#b07cff', orange: '#ff9b4e', pink: '#ff7cb5', cyan: '#4ed1e6',
};

async function save() {
  errors.value = [];
  let frontmatter;
  if (advancedJson.value) {
    try { frontmatter = JSON.parse(jsonText.value || '{}'); }
    catch (e) {
      errors.value = ['JSON 格式錯誤：' + e.message];
      return;
    }
  } else {
    frontmatter = stripEmpty(fm.value);
  }
  saving.value = true;
  try {
    emit('save', {
      frontmatter,
      body: body.value,
      expectedMtime: props.resource.mtime,
    });
  } finally { saving.value = false; }
}

function stripEmpty(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v) && !v.length) continue;
    out[k] = v;
  }
  return out;
}

function syncToJson() {
  jsonText.value = JSON.stringify(stripEmpty(fm.value), null, 2);
}

function syncFromJson() {
  try { fm.value = JSON.parse(jsonText.value || '{}'); }
  catch {}
}

defineExpose({ showValidationErrors: (errs) => { errors.value = errs; } });
</script>

<template>
  <div class="editor-shell">
    <div class="toolbar">
      <button @click="editMode = !editMode">{{ editMode ? '取消編輯' : '✏️ 編輯' }}</button>
      <button v-if="editMode" class="primary" :disabled="saving" @click="save">💾 儲存</button>
      <label v-if="editMode" style="display: flex; align-items: center; gap: 6px; margin-left: 8px">
        <input
          type="checkbox"
          v-model="advancedJson"
          @change="advancedJson ? syncToJson() : syncFromJson()"
        />
        Advanced JSON
      </label>
    </div>

    <div v-if="errors.length" class="card" style="border-color: var(--danger)">
      <strong style="color: var(--danger)">驗證失敗：</strong>
      <ul style="margin: 8px 0 0; padding-left: 20px">
        <li v-for="(err, i) in errors" :key="i" class="error">{{ err }}</li>
      </ul>
    </div>

    <template v-if="editMode && !advancedJson && schema">
      <div class="card">
        <h3 style="margin-top: 0">必填欄位</h3>
        <div class="form-row">
          <label>name <span class="required">*</span></label>
          <input v-model="fm.name" placeholder="agent-name-in-kebab-case" />
        </div>
        <div class="form-row">
          <label>description <span class="required">*</span></label>
          <textarea v-model="fm.description" rows="2" placeholder="何時委派任務的單行描述" />
        </div>
      </div>

      <div class="card">
        <h3 style="margin-top: 0">執行設定</h3>
        <div class="form-row">
          <label>model</label>
          <input v-model="fm.model" placeholder="inherit / sonnet / opus / haiku / 完整 model id" list="model-suggestions" />
          <datalist id="model-suggestions">
            <option v-for="s in schema.model.suggestions" :key="s" :value="s" />
          </datalist>
        </div>
        <div class="form-row">
          <label>permissionMode</label>
          <select v-model="fm.permissionMode">
            <option :value="undefined">(default)</option>
            <option v-for="o in schema.permissionMode.enum" :key="o" :value="o">{{ o }}</option>
          </select>
        </div>
        <div class="form-row">
          <label>effort</label>
          <select v-model="fm.effort">
            <option :value="undefined">(inherit)</option>
            <option v-for="o in schema.effort.enum" :key="o" :value="o">{{ o }}</option>
          </select>
        </div>
        <div class="form-row">
          <label>maxTurns</label>
          <input type="number" v-model.number="fm.maxTurns" placeholder="無限制" />
        </div>
        <div class="form-row">
          <label>memory</label>
          <select v-model="fm.memory">
            <option :value="undefined">(無)</option>
            <option v-for="o in schema.memory.enum" :key="o" :value="o">{{ o }}</option>
          </select>
        </div>
        <div class="form-row">
          <label>isolation</label>
          <select v-model="fm.isolation">
            <option :value="undefined">(無)</option>
            <option v-for="o in schema.isolation.enum" :key="o" :value="o">{{ o }}</option>
          </select>
        </div>
        <div class="form-row">
          <label style="display: flex; align-items: center; gap: 8px">
            <input type="checkbox" :checked="fm.background === true" @change="e => fm.background = e.target.checked || undefined" />
            background（背景執行）
          </label>
        </div>
      </div>

      <div class="card">
        <h3 style="margin-top: 0">工具</h3>
        <div class="form-row">
          <label>tools（白名單，點 chip 切換 / 空表示繼承）</label>
          <div class="tool-grid">
            <button
              v-for="t in knownTools"
              :key="t"
              type="button"
              class="tool-chip"
              :class="{ active: isToolSelected(t) }"
              @click="toggleTool(t)"
            >{{ t }}</button>
          </div>
          <input
            style="margin-top: 8px"
            :value="toolsAsList.join(', ')"
            @change="e => toolsAsList = e.target.value.split(',').map(s => s.trim()).filter(Boolean)"
            placeholder="或直接輸入（逗號分隔，可填 mcp__xxx__yyy）"
          />
        </div>
        <div class="form-row">
          <label>disallowedTools（黑名單）</label>
          <input
            :value="disallowedAsList.join(', ')"
            @change="e => disallowedAsList = e.target.value.split(',').map(s => s.trim()).filter(Boolean)"
            placeholder="Edit, Write, ..."
          />
        </div>
      </div>

      <div class="card">
        <h3 style="margin-top: 0">外觀</h3>
        <div class="form-row">
          <label>color</label>
          <div class="color-grid">
            <button
              type="button"
              class="color-swatch"
              :class="{ active: !fm.color }"
              @click="fm.color = undefined"
              title="無顏色"
            >×</button>
            <button
              v-for="c in COLOR_OPTIONS"
              :key="c"
              type="button"
              class="color-swatch"
              :class="{ active: fm.color === c }"
              :style="{ background: COLOR_HEX[c] }"
              @click="fm.color = c"
              :title="c"
            />
          </div>
        </div>
      </div>

      <div class="card">
        <h3 style="margin-top: 0">進階</h3>
        <div class="form-row">
          <label>skills（預載技能，逗號分隔）</label>
          <input
            :value="skillsAsList.join(', ')"
            @change="e => skillsAsList = e.target.value.split(',').map(s => s.trim()).filter(Boolean)"
          />
        </div>
        <div class="form-row">
          <label>initialPrompt</label>
          <textarea v-model="fm.initialPrompt" rows="3" placeholder="首輪自動提交給 agent 的提示" />
        </div>
        <div class="form-row">
          <label>mcpServers (JSON object / array)</label>
          <textarea
            :value="fm.mcpServers ? JSON.stringify(fm.mcpServers, null, 2) : ''"
            @change="e => { try { fm.mcpServers = e.target.value ? JSON.parse(e.target.value) : undefined; } catch (err) { errors = ['mcpServers JSON 錯誤: ' + err.message]; } }"
            rows="4"
            placeholder='{"playwright": {...}}'
          />
        </div>
        <div class="form-row">
          <label>hooks (JSON object)</label>
          <textarea
            :value="fm.hooks ? JSON.stringify(fm.hooks, null, 2) : ''"
            @change="e => { try { fm.hooks = e.target.value ? JSON.parse(e.target.value) : undefined; } catch (err) { errors = ['hooks JSON 錯誤: ' + err.message]; } }"
            rows="4"
            placeholder='{"PreToolUse": [...]}'
          />
        </div>
      </div>

      <div class="card">
        <h3 style="margin-top: 0">Body (Markdown)</h3>
        <textarea v-model="body" style="min-height: 400px" />
      </div>
    </template>

    <template v-else-if="editMode && advancedJson">
      <div class="card">
        <h3 style="margin-top: 0">Frontmatter (JSON)</h3>
        <textarea v-model="jsonText" style="min-height: 360px" />
      </div>
      <div class="card">
        <h3 style="margin-top: 0">Body (Markdown)</h3>
        <textarea v-model="body" style="min-height: 400px" />
      </div>
    </template>

    <template v-else>
      <div class="card" v-if="resource.frontmatter && Object.keys(resource.frontmatter).length">
        <h3 style="margin-top: 0">Frontmatter</h3>
        <pre style="margin: 0">{{ JSON.stringify(resource.frontmatter, null, 2) }}</pre>
      </div>
      <MarkdownView :source="body" />
    </template>
  </div>
</template>

<style scoped>
.form-row { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; }
.form-row label {
  font-size: 15px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--dim);
}
.form-row .required { color: var(--danger); margin-left: 4px; }

.tool-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.tool-chip {
  background: transparent;
  border: 1px solid var(--line-bright);
  color: var(--bone);
  padding: 6px 14px;
  font-size: 15px;
  font-family: var(--mono);
  cursor: pointer;
  letter-spacing: 0.04em;
  text-transform: none;
}
.tool-chip::before, .tool-chip::after { content: none !important; }
.tool-chip:hover {
  border-color: var(--amber);
  color: var(--amber);
  box-shadow: 0 0 8px var(--amber-glow);
}
.tool-chip.active {
  background: var(--amber);
  color: #000;
  border-color: var(--amber);
}
.tool-chip.active:hover {
  background: var(--cream);
  border-color: var(--cream);
  color: #000;
}

.color-grid { display: flex; gap: 10px; }
.color-swatch {
  width: 36px;
  height: 36px;
  border: 1px solid var(--line-bright);
  cursor: pointer;
  padding: 0;
  background: var(--bg-soft);
  color: var(--dim);
  font-size: 16px;
}
.color-swatch::before, .color-swatch::after { content: none !important; }
.color-swatch:hover { border-color: var(--amber); }
.color-swatch.active {
  border-color: var(--cream);
  outline: 1px solid var(--amber);
  outline-offset: 2px;
}
</style>
