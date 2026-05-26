import { defineStore } from 'pinia';
import { api } from '../api.js';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    loading: true,
    error: null,
  }),

  actions: {
    async hydrate() {
      this.loading = true;
      try {
        const { user } = await api.me();
        this.user = user;
      } catch (e) {
        this.user = null;
      } finally {
        this.loading = false;
      }
    },

    async loginWithCredential(credential) {
      this.error = null;
      try {
        const { user } = await api.loginWithGoogle(credential);
        this.user = user;
      } catch (e) {
        this.error = e.message;
        throw e;
      }
    },

    async logout() {
      try { await api.logout(); } catch {}
      this.user = null;
    },
  },
});
