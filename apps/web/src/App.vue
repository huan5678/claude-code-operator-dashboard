<script setup>
import { computed, onMounted, ref } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';
import { useAuthStore } from './stores/auth.js';
import StatusPulse from './components/StatusPulse.vue';

const route = useRoute();
const auth = useAuthStore();
const isLogin = computed(() => route.name === 'login');

const clock = ref('--:--:--');
function tick() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  clock.value = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
onMounted(() => { tick(); setInterval(tick, 1000); });

async function logout() {
  await auth.logout();
  location.href = '/login';
}
</script>

<template>
  <div v-if="isLogin">
    <RouterView />
  </div>
  <div v-else class="app-shell">
    <aside class="sidebar">
      <h1>FANCY/CODD</h1>
      <p class="sub">// console v0.1</p>
      <div class="nav">
        <RouterLink to="/identity">IDENTITY</RouterLink>
        <RouterLink to="/skills">SKILLS</RouterLink>
        <RouterLink to="/agents">AGENTS</RouterLink>
        <RouterLink to="/tasks">TASKS</RouterLink>
        <RouterLink to="/memory">MEMORY</RouterLink>
        <RouterLink to="/kanban">KANBAN</RouterLink>
        <RouterLink to="/sessions">SESSIONS</RouterLink>
        <RouterLink to="/profiles">PROFILES</RouterLink>
      </div>
      <div class="footer">
        <StatusPulse v-if="auth.user" />
        <div v-if="auth.user" class="email">{{ auth.user.email }}</div>
        <div>SYS · {{ clock }}</div>
        <button v-if="auth.user" @click="logout" style="margin-top: 10px; width: 100%">LOGOUT</button>
      </div>
    </aside>
    <main class="main">
      <RouterView />
    </main>
  </div>
</template>
