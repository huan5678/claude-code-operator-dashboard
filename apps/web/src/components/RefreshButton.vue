<script setup>
import { ref } from 'vue';

const props = defineProps({
  onRefresh: { type: Function, required: true },
});

const loading = ref(false);

async function click() {
  if (loading.value) return;
  loading.value = true;
  try { await props.onRefresh(); }
  finally { loading.value = false; }
}
</script>

<template>
  <button @click="click" :disabled="loading" class="refresh-btn">
    <span :class="['icon', { spin: loading }]">↻</span>
    REFRESH
  </button>
</template>

<style scoped>
.refresh-btn { display: inline-flex; align-items: center; gap: 6px; }
.icon { display: inline-block; }
.spin { animation: spin 600ms linear infinite; }
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
</style>
