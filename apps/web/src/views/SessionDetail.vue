<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { api } from '../api.js';

const props = defineProps({ id: { type: String, required: true } });
const router = useRouter();
const session = ref(null);
const error = ref(null);
const streamStatus = ref('connecting');  // connecting / live / reconnecting / closed
const termEl = ref(null);

let term = null;
let fitAddon = null;
let es = null;
let metaTimer = null;
let resizeObs = null;

async function loadMeta() {
  try {
    session.value = await api.getSession(props.id);
  } catch (e) {
    error.value = e.message;
  }
}

function startStream() {
  if (es) es.close();
  streamStatus.value = 'connecting';

  es = new EventSource(`/api/terminal/sessions/${props.id}/stream`, { withCredentials: true });

  es.addEventListener('data', (e) => {
    streamStatus.value = 'live';
    try {
      const raw = atob(e.data);
      term?.write(raw);
    } catch {}
  });

  es.addEventListener('exit', (e) => {
    streamStatus.value = 'closed';
    try {
      const payload = JSON.parse(e.data);
      term?.write(`\r\n\x1b[33m[session exited: code=${payload.exitCode ?? 'n/a'} signal=${payload.signal ?? 'n/a'}]\x1b[0m\r\n`);
    } catch {}
    es?.close();
  });

  es.onerror = () => {
    if (streamStatus.value !== 'closed') streamStatus.value = 'reconnecting';
  };
}

async function kill() {
  if (!confirm('Kill this session?')) return;
  await api.killSession(props.id);
  await loadMeta();
}

async function restart() {
  const fresh = await api.restartSession(props.id);
  router.push(`/sessions/${fresh.id}`);
}

async function openDesktop() {
  const takeover = confirm(
    '在桌面開啟 Terminal.app 後，是否同時終止 web session？\n\n' +
    '[ 確定 ] = 接管：桌面 Terminal 跑、kill 掉 web session、跳回列表\n' +
    '[ 取消 ] = 保留：兩邊都跑（背景同進程繼續、桌面也有一個）'
  );
  try {
    await api.openSessionDesktop(props.id);
    if (takeover) {
      try { await api.killSession(props.id); } catch {}
      router.push('/sessions');
    }
  } catch (e) {
    alert(e.message || 'open desktop failed');
  }
}

onMounted(async () => {
  // 1) 建立 xterm
  term = new Terminal({
    cursorBlink: false,
    convertEol: false,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 13,
    theme: {
      background: '#000000',
      foreground: '#e8e6d8',
      cursor: '#ffb300',
    },
    scrollback: 5000,
  });
  fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  await nextTick();
  if (termEl.value) {
    term.open(termEl.value);
    fitAddon.fit();
  }

  // 2) Meta polling（status / pid / restart_count 等變動慢，3 秒夠）
  await loadMeta();
  metaTimer = setInterval(loadMeta, 3000);

  // 3) 視窗 resize → re-fit xterm
  resizeObs = new ResizeObserver(() => {
    try { fitAddon?.fit(); } catch {}
  });
  if (termEl.value) resizeObs.observe(termEl.value);

  // 4) 開 SSE
  startStream();
});

onUnmounted(() => {
  if (metaTimer) clearInterval(metaTimer);
  if (es) es.close();
  if (resizeObs) resizeObs.disconnect();
  if (term) term.dispose();
});

watch(() => props.id, (newId, oldId) => {
  if (newId === oldId) return;
  loadMeta();
  term?.reset();
  startStream();
});
</script>

<template>
  <RouterLink to="/sessions" style="font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase">← back / sessions</RouterLink>
  <h2 v-if="session" style="margin-top: 12px">{{ session.profile_name }}</h2>
  <p v-if="session" class="section-meta">
    SESSION · {{ session.id.slice(0, 8) }} ·
    <span :class="['chip', session.status === 'running' ? 'primary' : 'dim']">{{ session.status }}</span>
    · <span :class="['chip', streamStatus === 'live' ? 'primary' : 'dim']">stream:{{ streamStatus }}</span>
    · pid {{ session.pid }} · started {{ session.started_at?.replace('T', ' ').slice(0, 19) }}
    · <code class="path">{{ session.log_path }}</code>
  </p>

  <div class="toolbar" v-if="session">
    <button @click="openDesktop" title="在 macOS 桌面另開一個 Terminal.app 跑同樣命令">↗ OPEN IN TERMINAL.APP</button>
    <button v-if="session.status === 'running'" class="danger" @click="kill">🛑 KILL</button>
    <button @click="restart">↻ RESTART</button>
  </div>

  <p v-if="error" class="error">{{ error }}</p>

  <div v-if="session" class="card term-card">
    <h3 style="margin-top: 0">LIVE TERMINAL · xterm.js · SSE</h3>
    <div ref="termEl" class="term-host" />
  </div>
</template>

<style scoped>
.term-card {
  padding: 14px 16px;
  background: #000;
  border: 1px solid var(--line-bright);
}
.term-host {
  height: 600px;
  width: 100%;
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
