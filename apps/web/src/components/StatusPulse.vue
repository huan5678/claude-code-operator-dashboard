<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { api } from '../api.js';

const items = ref([]);
let timer = null;

async function poll() {
  try {
    const data = await api.getStatus();
    items.value = data.items || [];
  } catch {
    items.value = [];
  }
}

onMounted(() => { poll(); timer = setInterval(poll, 30000); });
onUnmounted(() => { if (timer) clearInterval(timer); });

function lampClass(item) {
  if (!item || item.status !== 'running') return 'lamp-dim';
  if (item.stale) return 'lamp-red';
  // 沒有 hook 心跳資料時，只知道 process 活著 → 綠燈
  if (item.idle_seconds == null) return 'lamp-green';
  const idle = item.idle_seconds;
  if (idle < 300) return 'lamp-green';
  if (idle < 900) return 'lamp-amber';
  return 'lamp-red';
}

function fmtSecs(s) {
  if (s == null) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}m`;
  return `${m}m${String(s % 60).padStart(2, '0')}s`;
}

// 主時間顯示 runtime；有 hook idle 時用 idle（更能反映 agent 是否在動）
function timeStr(item) {
  return fmtSecs(item.idle_seconds ?? item.runtime_seconds);
}

function label(item) {
  return item.profile_name || (item.session_id ? item.session_id.slice(0, 8) : '—');
}
</script>

<template>
  <div class="status-pulse">
    <div class="header">
      <span class="label">PULSE</span>
      <span class="count">{{ items.length }}</span>
    </div>
    <div v-if="!items.length" class="empty">
      <span class="lamp lamp-dim">○</span>
      <span class="hint">// no active sessions</span>
    </div>
    <div v-for="item in items" :key="item.session_id" class="row">
      <span :class="['lamp', lampClass(item)]">●</span>
      <span class="sid">{{ label(item) }}</span>
      <span class="idle">{{ timeStr(item) }}</span>
      <span class="tool">{{ item.last_tool || '—' }}</span>
    </div>
  </div>
</template>

<style scoped>
.status-pulse {
  border: 1px solid var(--line);
  padding: 10px 12px;
  margin-bottom: 14px;
  background: var(--bg-soft);
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 11.5px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--dim);
  border-bottom: 1px dashed var(--line);
  padding-bottom: 6px;
  margin-bottom: 8px;
}
.header .count {
  color: var(--amber);
  font-size: 13px;
  font-family: var(--mono);
}
.row {
  display: grid;
  grid-template-columns: 16px 1fr auto;
  grid-template-rows: auto auto;
  column-gap: 6px;
  align-items: baseline;
  padding: 4px 0;
  font-size: 12.5px;
}
.row .lamp { grid-row: 1 / 3; }
.row .sid { color: var(--bone); font-family: var(--mono); }
.row .idle { color: var(--dim); font-size: 11.5px; }
.row .tool {
  grid-column: 2 / 4;
  grid-row: 2;
  color: var(--dim);
  font-size: 11.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.empty { display: flex; gap: 6px; align-items: center; padding: 4px 0; }
.hint { color: var(--dim); font-size: 12px; }
.lamp { font-family: var(--mono); }
.lamp-green { color: var(--success); text-shadow: 0 0 6px rgba(124, 255, 154, 0.6); }
.lamp-amber { color: var(--amber); text-shadow: 0 0 6px var(--amber-glow); }
.lamp-red { color: var(--danger); text-shadow: 0 0 6px rgba(255, 112, 88, 0.6); }
.lamp-dim { color: var(--dimmer); }
</style>
