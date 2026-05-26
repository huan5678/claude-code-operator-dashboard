<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { api } from '../api.js';

const props = defineProps({ id: { type: String, required: true } });
const router = useRouter();
const session = ref(null);
const log = ref('');
const error = ref(null);
const logBox = ref(null);
let timer = null;

async function load() {
  try {
    session.value = await api.getSession(props.id);
    const { log: l } = await api.getSessionLog(props.id, 500);
    log.value = l;
    await nextTick();
    if (logBox.value) logBox.value.scrollTop = logBox.value.scrollHeight;
  } catch (e) {
    error.value = e.message;
  }
}

async function kill() {
  if (!confirm('Kill this session?')) return;
  await api.killSession(props.id);
  await load();
}

async function restart() {
  const fresh = await api.restartSession(props.id);
  router.push(`/sessions/${fresh.id}`);
}

onMounted(() => {
  load();
  timer = setInterval(load, 3000);
});
onUnmounted(() => { if (timer) clearInterval(timer); });

watch(() => props.id, () => { load(); });

function stripAnsi(s) {
  // 基本 ANSI escape stripper（顯示乾淨，但保留行結構）
  return (s || '').replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').replace(/\r/g, '');
}
</script>

<template>
  <RouterLink to="/sessions" style="font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase">← back / sessions</RouterLink>
  <h2 v-if="session" style="margin-top: 12px">{{ session.profile_name }}</h2>
  <p v-if="session" class="section-meta">
    SESSION · {{ session.id.slice(0, 8) }} ·
    <span :class="['chip', session.status === 'running' ? 'primary' : 'dim']">{{ session.status }}</span>
    · pid {{ session.pid }} · started {{ session.started_at?.replace('T', ' ').slice(0, 19) }}
    · <code class="path">{{ session.log_path }}</code>
  </p>

  <div class="toolbar" v-if="session">
    <button v-if="session.status === 'running'" class="danger" @click="kill">🛑 KILL</button>
    <button @click="restart">↻ RESTART</button>
  </div>

  <p v-if="error" class="error">{{ error }}</p>

  <div v-if="session" class="card">
    <h3 style="margin-top: 0">LOG TAIL · 自動更新每 3 秒</h3>
    <pre ref="logBox" class="log-box">{{ stripAnsi(log) || '(no output yet)' }}</pre>
  </div>
</template>

<style scoped>
.spacer { flex: 1; }
.log-box {
  background: #000;
  border: 1px solid var(--line-bright);
  padding: 14px 16px;
  max-height: 600px;
  overflow-y: auto;
  font-family: var(--mono);
  font-size: 13px;
  line-height: 1.55;
  color: var(--bone);
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}
.chip {
  background: transparent;
  border: 1px solid var(--line-bright);
  color: var(--bone);
  padding: 2px 10px;
  font-size: 12.5px;
  letter-spacing: 0.06em;
  text-transform: lowercase;
}
.chip.primary { background: var(--success); border-color: var(--success); color: #000; }
.chip.dim { color: var(--dim); }
</style>
