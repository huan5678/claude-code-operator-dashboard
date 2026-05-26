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
const warnings = ref([]);
const schema = ref(null);
const knownTools = ref([]);

onMounted(async () => {
  const data = await api.getSkillSchema();
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
  warnings.value = [];
}, { immediate: true });

const allowedToolsList = computed({
  get: () => normaliseList(fm.value['allowed-tools']),
  set: (v) => { fm.value['allowed-tools'] = v.length ? v : undefined; },
});

const pathsList = computed({
  get: () => normaliseList(fm.value.paths),
  set: (v) => { fm.value.paths = v.length ? v : undefined; },
});

const argsList = computed({
  get: () => normaliseList(fm.value.arguments),
  set: (v) => { fm.value.arguments = v.length ? v : undefined; },
});

const triggersZh = computed({
  get: () => normaliseList(fm.value.triggers_zh),
  set: (v) => { fm.value.triggers_zh = v.length ? v : undefined; },
});

const triggersEn = computed({
  get: () => normaliseList(fm.value.triggers_en),
  set: (v) => { fm.value.triggers_en = v.length ? v : undefined; },
});

function normaliseList(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return String(val).split(',').map(s => s.trim()).filter(Boolean);
}

function toggleTool(tool) {
  const list = allowedToolsList.value.slice();
  const idx = list.indexOf(tool);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(tool);
  allowedToolsList.value = list;
}

function isToolSelected(tool) {
  return allowedToolsList.value.includes(tool);
}

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

defineExpose({
  showValidationErrors: (errs) => { errors.value = errs; },
  showWarnings: (warns) => { warnings.value = warns; },
});
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

    <div v-if="warnings.length" class="card" style="border-color: var(--amber)">
      <strong style="color: var(--amber)">提示（已儲存）：</strong>
      <ul style="margin: 8px 0 0; padding-left: 20px">
        <li v-for="(w, i) in warnings" :key="i" class="notice">{{ w }}</li>
      </ul>
    </div>

    <template v-if="editMode && !advancedJson && schema">
      <div class="card">
        <h3 style="margin-top: 0">基本</h3>
        <div class="form-row">
          <label>name <span class="hint">(留空 = 用目錄名 {{ resource.slug }})</span></label>
          <input v-model="fm.name" :placeholder="resource.slug" />
        </div>
        <div class="form-row">
          <label>description <span class="hint">(極建議填，Claude 用來決定何時加載)</span></label>
          <textarea v-model="fm.description" rows="3" placeholder="這個 skill 何時應該被加載..." />
        </div>
        <div class="form-row">
          <label>when_to_use <span class="hint">(觸發提示)</span></label>
          <textarea v-model="fm.when_to_use" rows="2" />
        </div>
      </div>

      <div class="card">
        <h3 style="margin-top: 0">觸發詞（自定義欄位）</h3>
        <div class="form-row">
          <label>triggers_zh (逗號分隔)</label>
          <input
            :value="triggersZh.join(', ')"
            @change="e => triggersZh = e.target.value.split(',').map(s => s.trim()).filter(Boolean)"
            placeholder="推週排程, 今日提醒, ..."
          />
        </div>
        <div class="form-row">
          <label>triggers_en (逗號分隔)</label>
          <input
            :value="triggersEn.join(', ')"
            @change="e => triggersEn = e.target.value.split(',').map(s => s.trim()).filter(Boolean)"
            placeholder="push weekly agenda, ..."
          />
        </div>
      </div>

      <div class="card">
        <h3 style="margin-top: 0">執行設定</h3>
        <div class="form-row">
          <label>model</label>
          <input v-model="fm.model" placeholder="inherit / sonnet / opus / haiku" list="skill-model-suggestions" />
          <datalist id="skill-model-suggestions">
            <option v-for="s in schema.model.suggestions" :key="s" :value="s" />
          </datalist>
        </div>
        <div class="form-row">
          <label>effort</label>
          <select v-model="fm.effort">
            <option :value="undefined">(inherit)</option>
            <option v-for="o in schema.effort.enum" :key="o" :value="o">{{ o }}</option>
          </select>
        </div>
        <div class="form-row">
          <label>context</label>
          <select v-model="fm.context">
            <option :value="undefined">(inline)</option>
            <option v-for="o in schema.context.enum" :key="o" :value="o">{{ o }}</option>
          </select>
        </div>
        <div class="form-row" v-if="fm.context === 'fork'">
          <label>agent <span class="hint">(context=fork 時的子 agent 類型)</span></label>
          <input v-model="fm.agent" placeholder="general-purpose / Explore / Plan" />
        </div>
        <div class="form-row">
          <label>shell</label>
          <select v-model="fm.shell">
            <option :value="undefined">(bash)</option>
            <option v-for="o in schema.shell.enum" :key="o" :value="o">{{ o }}</option>
          </select>
        </div>
      </div>

      <div class="card">
        <h3 style="margin-top: 0">行為</h3>
        <div class="form-row">
          <label style="display: flex; align-items: center; gap: 8px">
            <input type="checkbox" :checked="fm['disable-model-invocation'] === true" @change="e => fm['disable-model-invocation'] = e.target.checked || undefined" />
            disable-model-invocation
            <span class="hint">(禁止 Claude 自動加載，僅手動 /skill 呼叫)</span>
          </label>
        </div>
        <div class="form-row">
          <label style="display: flex; align-items: center; gap: 8px">
            <input type="checkbox" :checked="fm['user-invocable'] !== false" @change="e => fm['user-invocable'] = e.target.checked ? undefined : false" />
            user-invocable
            <span class="hint">(顯示在 / 菜單，預設開啟)</span>
          </label>
        </div>
      </div>

      <div class="card">
        <h3 style="margin-top: 0">允許工具</h3>
        <div class="form-row">
          <label>allowed-tools（白名單，點 chip 切換）</label>
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
            :value="allowedToolsList.join(', ')"
            @change="e => allowedToolsList = e.target.value.split(',').map(s => s.trim()).filter(Boolean)"
            placeholder="或直接輸入（逗號分隔，可填 Bash(git *) 等含括號的型式）"
          />
        </div>
      </div>

      <div class="card">
        <h3 style="margin-top: 0">參數 / 範圍</h3>
        <div class="form-row">
          <label>argument-hint</label>
          <input v-model="fm['argument-hint']" placeholder="[issue-number] 或 [filename] [format]" />
        </div>
        <div class="form-row">
          <label>arguments (逗號分隔)</label>
          <input
            :value="argsList.join(', ')"
            @change="e => argsList = e.target.value.split(',').map(s => s.trim()).filter(Boolean)"
            placeholder="issue, branch"
          />
        </div>
        <div class="form-row">
          <label>paths (glob，逗號分隔)</label>
          <input
            :value="pathsList.join(', ')"
            @change="e => pathsList = e.target.value.split(',').map(s => s.trim()).filter(Boolean)"
            placeholder="**/*.py, src/**"
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
.form-row label .hint {
  text-transform: none;
  letter-spacing: 0.01em;
  color: var(--dimmer);
  font-size: 13px;
  margin-left: 6px;
}

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
</style>
