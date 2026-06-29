<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { api } from '../api.js';

// 與 server PTY 對齊（apps/server/src/services/terminal-manager.js: cols 120, rows 30）
const TERM_COLS = 120;
const TERM_ROWS = 30;

const props = defineProps({ id: { type: String, required: true } });
const router = useRouter();
const session = ref(null);
const error = ref(null);
const streamStatus = ref('connecting');  // connecting / live / reconnecting / closed
const termEl = ref(null);

let term = null;
let es = null;
let metaTimer = null;

// 輸入緩衝：xterm.onData 每按一鍵 fire 一次，10ms debounce 合併同 tick 的 keystroke
// 避免太多小 POST，又不會讓人感覺到延遲
const INPUT_DEBOUNCE_MS = 10;
let inputBuffer = '';
let inputFlushTimer = null;
const textEncoder = new TextEncoder();

function bytesToBase64(bytes) {
  // Uint8Array → latin1 string → btoa
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function flushInput() {
  inputFlushTimer = null;
  if (!inputBuffer) return;
  const bytes = textEncoder.encode(inputBuffer);
  inputBuffer = '';
  const b64 = bytesToBase64(bytes);
  api.sendSessionInput(props.id, b64).catch((e) => {
    // session 已 exit / 網路問題：靜默；用戶可從 stream 狀態看出 session 死了
    console.warn('[input] send failed:', e.message);
  });
}

function scheduleInputFlush() {
  if (inputFlushTimer) return;
  inputFlushTimer = setTimeout(flushInput, INPUT_DEBOUNCE_MS);
}

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
      // atob 回傳 latin1 string（每個 char = 一個 byte 值）。
      // 直接 term.write(string) 會把 byte 當成 codepoint，UTF-8 multi-byte 會變成
      // â + 控制碼之類的亂碼。改成轉 Uint8Array 餵給 xterm，它會自己 decode UTF-8。
      const bin = atob(e.data);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      term?.write(bytes);
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
  // 1) 先 loadMeta，讓 v-if="session" 為真，termEl 才會渲染出來
  await loadMeta();
  metaTimer = setInterval(loadMeta, 3000);

  // 2) 建立 xterm（固定 cols/rows 與 server PTY 對齊，不用 FitAddon）
  //    Server PTY 不支援 resize（terminal-manager 固定 cols 120 / rows 30，也沒有
  //    resize route），所以 cols/rows 必須保持固定，否則畫面會錯位。
  //    手機上改用較小 fontSize，讓固定的 120 cols 在 overflow-x:auto 容器裡更好讀。
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  term = new Terminal({
    cols: TERM_COLS,
    rows: TERM_ROWS,
    cursorBlink: false,
    convertEol: false,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: isMobile ? 10 : 13,
    theme: {
      background: '#000000',
      foreground: '#e8e6d8',
      cursor: '#ffb300',
    },
    scrollback: 5000,
  });

  // 3) 等 v-if 渲染出 .term-host 之後再 open；同時 hook keyboard input
  await nextTick();
  if (termEl.value) {
    term.open(termEl.value);
    term.focus();
    // xterm 把所有按鍵（含 arrow keys / Ctrl-C / Tab / IME 中文）對成正確的
    // byte sequence 給 onData，直接 buffer + debounce 送到 server PTY stdin
    term.onData((s) => {
      inputBuffer += s;
      scheduleInputFlush();
    });
  }

  // 4) 開 SSE
  startStream();
});

onUnmounted(() => {
  if (metaTimer) clearInterval(metaTimer);
  if (inputFlushTimer) { clearTimeout(inputFlushTimer); inputFlushTimer = null; }
  inputBuffer = '';
  if (es) es.close();
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
  /* 卡片包住 xterm 的內在尺寸即可，不再 stretch */
  width: max-content;
  max-width: 100%;
  overflow-x: auto;
}
.term-host {
  /* 讓 xterm 用自己的內在尺寸（cols × rows），避免容器拉伸造成排版錯位 */
  display: inline-block;
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
