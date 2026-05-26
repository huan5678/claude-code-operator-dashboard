<script setup>
import { ref, onMounted, computed } from 'vue';
import { RouterLink } from 'vue-router';
import { api } from '../api.js';

const sessions = ref([]);
const profiles = ref([]);
const selectedProfileId = ref(null);
const loading = ref(true);
const spawning = ref(false);
const error = ref(null);

async function load() {
  loading.value = true;
  try {
    const [s, p] = await Promise.all([api.listSessions(), api.listProfiles()]);
    sessions.value = s.items;
    profiles.value = p.items;
    if (!selectedProfileId.value && p.items.length) selectedProfileId.value = p.items[0].id;
  } finally { loading.value = false; }
}

async function spawn() {
  if (!selectedProfileId.value) return;
  error.value = null;
  spawning.value = true;
  try {
    await api.spawnSession(selectedProfileId.value);
    await load();
  } catch (e) { error.value = e.message; }
  finally { spawning.value = false; }
}

async function kill(id) {
  if (!confirm('Kill this session?')) return;
  await api.killSession(id);
  await load();
}

async function restart(id) {
  await api.restartSession(id);
  await load();
}

onMounted(load);

const indexLabel = computed(() => {
  if (loading.value) return '';
  const running = sessions.value.filter(s => s.status === 'running').length;
  return `INDEX · ${sessions.value.length} sessions · ${running} running`;
});

function runtime(s) {
  const start = Date.parse(s.started_at);
  const end = s.exited_at ? Date.parse(s.exited_at) : Date.now();
  const secs = Math.floor((end - start) / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}m`;
  return `${m}m${String(secs % 60).padStart(2, '0')}s`;
}
</script>

<template>
  <div class="toolbar">
    <h2 style="margin: 0">SESSIONS</h2>
    <span class="spacer" />
    <select v-model="selectedProfileId" style="margin-right: 8px">
      <option v-for="p in profiles" :key="p.id" :value="p.id">{{ p.name }}</option>
    </select>
    <button class="primary" :disabled="spawning || !selectedProfileId" @click="spawn">+ NEW</button>
    <button @click="load">↻ REFRESH</button>
  </div>
  <p class="section-meta">{{ indexLabel || 'LOADING…' }}</p>
  <p v-if="error" class="error">{{ error }}</p>

  <p v-if="loading" class="notice">// loading …</p>
  <p v-else-if="!sessions.length" class="notice">// no sessions — click + NEW to spawn</p>
  <div v-else>
    <div v-for="s in sessions" :key="s.id" class="list-item">
      <div class="row">
        <RouterLink :to="`/sessions/${s.id}`" class="link">
          <strong>{{ s.profile_name }}</strong>
          <span class="notice">·  {{ s.id.slice(0, 8) }}</span>
        </RouterLink>
        <span :class="['chip', s.status === 'running' ? 'primary' : 'dim']">{{ s.status }}</span>
        <span class="chip">pid: {{ s.pid }}</span>
        <span class="chip">run: {{ runtime(s) }}</span>
        <span v-if="s.restart_count" class="chip">restarts: {{ s.restart_count }}</span>
        <span class="spacer" />
        <button v-if="s.status === 'running'" @click="kill(s.id)" class="danger">KILL</button>
        <button @click="restart(s.id)">RESTART</button>
      </div>
      <div class="meta">→ <code>{{ s.command }}</code></div>
    </div>
  </div>
</template>

<style scoped>
.row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.link { color: inherit; text-decoration: none; border-bottom: none; flex-shrink: 0; }
.link:hover strong { color: var(--amber); }
.chip {
  background: transparent;
  border: 1px solid var(--line-bright);
  color: var(--bone);
  padding: 2px 10px;
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: lowercase;
  font-family: var(--mono);
}
.chip.primary { background: var(--success); border-color: var(--success); color: #000; }
.chip.dim { color: var(--dim); }
.spacer { flex: 1; }
</style>
