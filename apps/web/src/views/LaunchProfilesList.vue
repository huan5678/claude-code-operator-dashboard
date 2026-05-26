<script setup>
import { ref, onMounted, computed } from 'vue';
import { api } from '../api.js';

const items = ref([]);
const loading = ref(true);
const error = ref(null);
const editingId = ref(null); // null = none, 'new' = creating, number = editing
const form = ref({ name: '', command: '', cwd: '', env: '{}' });

async function load() {
  loading.value = true;
  try {
    const { items: data } = await api.listProfiles();
    items.value = data;
  } finally { loading.value = false; }
}
onMounted(load);

function startCreate() {
  editingId.value = 'new';
  form.value = { name: '', command: '', cwd: '~/Claude-station', env: '{}' };
  error.value = null;
}

function startEdit(item) {
  editingId.value = item.id;
  form.value = {
    name: item.name,
    command: item.command,
    cwd: item.cwd,
    env: JSON.stringify(item.env || {}, null, 2),
  };
  error.value = null;
}

function duplicate(item) {
  editingId.value = 'new';
  // 避免撞 UNIQUE name，自動加 -copy / -copy-2 / -copy-3 ...
  const existing = new Set(items.value.map(p => p.name));
  let candidate = `${item.name}-copy`;
  let n = 2;
  while (existing.has(candidate)) candidate = `${item.name}-copy-${n++}`;
  form.value = {
    name: candidate,
    command: item.command,
    cwd: item.cwd,
    env: JSON.stringify(item.env || {}, null, 2),
  };
  error.value = null;
}

function cancelEdit() {
  editingId.value = null;
  error.value = null;
}

async function save() {
  error.value = null;
  let envParsed;
  try { envParsed = JSON.parse(form.value.env || '{}'); }
  catch (e) { error.value = 'env JSON 錯誤: ' + e.message; return; }
  const payload = { ...form.value, env: envParsed };
  try {
    if (editingId.value === 'new') await api.createProfile(payload);
    else await api.updateProfile(editingId.value, payload);
    editingId.value = null;
    await load();
  } catch (e) { error.value = e.message; }
}

async function remove(id) {
  if (!confirm('Delete this profile?')) return;
  await api.deleteProfile(id);
  await load();
}

const indexLabel = computed(() => loading.value ? '' : `INDEX · ${items.value.length} profiles`);
</script>

<template>
  <div class="toolbar">
    <h2 style="margin: 0">LAUNCH PROFILES</h2>
    <span class="spacer" />
    <button class="primary" @click="startCreate">+ NEW</button>
    <button @click="load">↻ REFRESH</button>
  </div>
  <p class="section-meta">{{ indexLabel || 'LOADING…' }}</p>
  <p v-if="error" class="error">{{ error }}</p>

  <div v-if="editingId !== null" class="card" style="border-color: var(--amber)">
    <h3 style="margin-top: 0">{{ editingId === 'new' ? 'NEW PROFILE' : 'EDIT PROFILE' }}</h3>
    <div class="form-row">
      <label>name</label>
      <input v-model="form.name" placeholder="claude-station / discord-channel / ..." />
    </div>
    <div class="form-row">
      <label>cwd</label>
      <input v-model="form.cwd" placeholder="~/Claude-station" />
    </div>
    <div class="form-row">
      <label>command</label>
      <input v-model="form.command" placeholder="claude --channels plugin:discord@claude-plugins-official" />
    </div>
    <div class="form-row">
      <label>env (JSON object)</label>
      <textarea v-model="form.env" rows="3" />
    </div>
    <div class="form-actions">
      <button @click="cancelEdit">取消</button>
      <button class="primary" @click="save">儲存</button>
    </div>
  </div>

  <p v-if="loading" class="notice">// loading …</p>
  <p v-else-if="!items.length" class="notice">// no profiles — click + NEW to create</p>
  <div v-for="p in items" :key="p.id" class="list-item">
    <div class="row">
      <strong>{{ p.name }}</strong>
      <span class="chip">{{ p.cwd }}</span>
      <span class="spacer" />
      <button @click="duplicate(p)">DUPLICATE</button>
      <button @click="startEdit(p)">EDIT</button>
      <button class="danger" @click="remove(p.id)">DELETE</button>
    </div>
    <div class="meta">→ <code>{{ p.command }}</code></div>
  </div>
</template>

<style scoped>
.row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.spacer { flex: 1; }
.chip {
  background: transparent;
  border: 1px solid var(--line-bright);
  color: var(--bone);
  padding: 2px 10px;
  font-size: 12.5px;
  font-family: var(--mono);
}
.form-row { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.form-row label {
  font-size: 12px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--dim);
}
.form-actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>
