<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';
import { useAuthStore } from './stores/auth.js';
import StatusPulse from './components/StatusPulse.vue';

const route = useRoute();
const auth = useAuthStore();
const isLogin = computed(() => route.name === 'login');

// 行動版側欄抽屜開關（桌機永遠展開，這個 state 只在 < 768px 生效）
const navOpen = ref(false);
function toggleNav() { navOpen.value = !navOpen.value; }
function closeNav() { navOpen.value = false; }

// 路由切換時自動關閉抽屜
watch(() => route.fullPath, closeNav);

// Esc 關閉抽屜
function onKeydown(e) {
  if (e.key === 'Escape') closeNav();
}
onMounted(() => { window.addEventListener('keydown', onKeydown); });
onUnmounted(() => { window.removeEventListener('keydown', onKeydown); });

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
  <div v-else class="app-shell" :class="{ 'nav-open': navOpen }">
    <header class="mobile-topbar">
      <button
        class="hamburger"
        type="button"
        :aria-expanded="navOpen"
        aria-controls="sidebar-nav"
        aria-label="切換導覽選單"
        @click="toggleNav"
      >≡ MENU</button>
      <span class="topbar-title">FANCY/CODD</span>
    </header>

    <aside id="sidebar-nav" class="sidebar" :class="{ open: navOpen }">
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

    <div v-if="navOpen" class="nav-backdrop" @click="closeNav" />

    <main class="main">
      <RouterView />
    </main>
  </div>
</template>
