<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const error = ref(null);

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

function safeRedirect(raw) {
  if (typeof raw !== 'string') return '/';
  // 只允許單一 / 開頭的相對路徑、不含 // 或 \（避免 protocol-relative / scheme bypass）
  if (!/^\/[^/\\]/.test(raw)) return '/';
  if (raw.includes('\\')) return '/';
  return raw;
}

async function handleCredential(response) {
  error.value = null;
  try {
    await auth.loginWithCredential(response.credential);
    router.replace(safeRedirect(route.query.redirect));
  } catch (e) {
    error.value = e.message || '登入失敗';
  }
}

onMounted(() => {
  function init() {
    if (!window.google?.accounts?.id) return setTimeout(init, 100);
    if (!clientId) {
      error.value = 'VITE_GOOGLE_CLIENT_ID 沒設定（在 root .env 寫入 GOOGLE_CLIENT_ID 即可）';
      return;
    }
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredential,
      ux_mode: 'popup',
      auto_select: false,
    });
    window.google.accounts.id.renderButton(
      document.getElementById('g-signin'),
      { theme: 'filled_black', size: 'large', shape: 'rectangular', text: 'signin_with' }
    );
  }
  init();
});
</script>

<template>
  <div class="login-shell">
    <div class="login-card">
      <h1>FANCY/CODD</h1>
      <p class="tag">// channel operator console</p>

      <div class="boot">
        <div class="line"><span class="ok">[ OK ]</span> bootloader      v0.1</div>
        <div class="line"><span class="ok">[ OK ]</span> sqlite/wal      ok</div>
        <div class="line"><span class="ok">[ OK ]</span> channel-reader  attached</div>
        <div class="line"><span class="ok">[ OK ]</span> mcp/stdio       ready</div>
        <div class="line"><span class="wait">[ .. ]</span> auth/google     <em>waiting for operator_</em></div>
      </div>

      <div id="g-signin" class="signin-host"></div>
      <p v-if="error" class="error">{{ error }}</p>
      <p class="hint">// allowlist only · session: jwt · cookie: httpOnly</p>
    </div>
  </div>
</template>
