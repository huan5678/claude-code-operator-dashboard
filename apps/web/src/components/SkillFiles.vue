<script setup>
import { ref, computed, watch } from 'vue';
import MarkdownView from './MarkdownView.vue';
import { api } from '../api.js';

const props = defineProps({ slug: { type: String, required: true } });

const entries = ref([]);
const loading = ref(true);
const listError = ref(null);

const selected = ref(null);     // 目前檢視的 file path
const file = ref(null);         // { path, size, binary, tooLarge, content }
const fileLoading = ref(false);
const fileError = ref(null);

// 主檔 SKILL.md 已由上方編輯器負責，這裡只列「附屬檔案」（reference/ 等子目錄與其它資源）
const visible = computed(() =>
  entries.value.filter(e => !(e.type === 'file' && e.path === 'SKILL.md'))
);

async function loadList() {
  loading.value = true;
  listError.value = null;
  selected.value = null;
  file.value = null;
  try {
    const { items } = await api.listSkillFiles(props.slug);
    entries.value = items;
  } catch (e) {
    listError.value = e.message;
    entries.value = [];
  } finally {
    loading.value = false;
  }
}

watch(() => props.slug, loadList, { immediate: true });

async function openFile(path) {
  selected.value = path;
  fileLoading.value = true;
  fileError.value = null;
  file.value = null;
  try {
    file.value = await api.getSkillFile(props.slug, path);
  } catch (e) {
    fileError.value = e.message;
  } finally {
    fileLoading.value = false;
  }
}

function depth(path) {
  return path.split('/').length - 1;
}
function leaf(path) {
  const segs = path.split('/');
  return segs[segs.length - 1];
}
function isMarkdown(path) {
  return /\.(md|markdown|mdx)$/i.test(path || '');
}
function fmtSize(n) {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
</script>

<template>
  <div class="card skill-files">
    <h3 style="margin-top: 0">FILES <span class="notice">· {{ slug }}/</span></h3>

    <p v-if="loading" class="notice">// scanning skill directory …</p>
    <p v-else-if="listError" class="error">{{ listError }}</p>
    <p v-else-if="!visible.length" class="notice">// no extra files (只有 SKILL.md)</p>

    <div v-else class="layout">
      <ul class="tree">
        <li
          v-for="e in visible"
          :key="e.path"
          :style="{ paddingLeft: `${depth(e.path) * 16 + 4}px` }"
          :class="['tree-row', e.type, { active: selected === e.path }]"
        >
          <span v-if="e.type === 'dir'" class="dir">▸ {{ leaf(e.path) }}/</span>
          <button v-else type="button" class="file-btn" @click="openFile(e.path)">
            <span class="fname">{{ leaf(e.path) }}</span>
            <span class="fsize">{{ fmtSize(e.size) }}</span>
          </button>
        </li>
      </ul>

      <div class="viewer">
        <p v-if="!selected" class="notice">// 點左側檔案以檢視內容</p>
        <template v-else>
          <div class="viewer-head">
            <code class="path">{{ selected }}</code>
            <span v-if="file" class="notice">· {{ fmtSize(file.size) }}</span>
          </div>
          <p v-if="fileLoading" class="notice">// loading …</p>
          <p v-else-if="fileError" class="error">{{ fileError }}</p>
          <template v-else-if="file">
            <p v-if="file.tooLarge" class="notice">// 檔案過大（{{ fmtSize(file.size) }}），不預覽</p>
            <p v-else-if="file.binary" class="notice">// binary 檔案（{{ fmtSize(file.size) }}），不預覽</p>
            <MarkdownView v-else-if="isMarkdown(file.path)" :source="file.content" />
            <pre v-else class="raw">{{ file.content }}</pre>
          </template>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.skill-files { margin-top: 16px; }
.layout {
  display: grid;
  grid-template-columns: minmax(180px, 280px) 1fr;
  gap: 16px;
  align-items: start;
}
.tree {
  list-style: none;
  margin: 0;
  padding: 0;
  border-right: 1px dashed var(--line);
  padding-right: 8px;
  max-height: 520px;
  overflow: auto;
}
.tree-row { font-family: var(--mono); font-size: 13px; line-height: 1.9; }
.tree-row .dir { color: var(--dim); letter-spacing: 0.04em; }
.file-btn {
  background: transparent;
  border: none;
  color: var(--bone);
  font-family: var(--mono);
  font-size: 13px;
  cursor: pointer;
  padding: 1px 6px;
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  text-align: left;
}
.file-btn::before, .file-btn::after { content: none !important; }
.file-btn:hover { color: var(--amber); }
.tree-row.active .file-btn { color: var(--amber); background: var(--bg-soft); }
.file-btn .fsize { color: var(--dimmer); font-size: 11.5px; flex-shrink: 0; }
.viewer { min-width: 0; }
.viewer-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px dashed var(--line);
}
.raw {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--mono);
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--bone);
}
@media (max-width: 720px) {
  .layout { grid-template-columns: 1fr; }
  .tree { border-right: none; border-bottom: 1px dashed var(--line); padding-right: 0; padding-bottom: 8px; }
}
</style>
