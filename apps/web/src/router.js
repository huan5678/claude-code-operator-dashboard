import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from './stores/auth.js';

const routes = [
  { path: '/login', name: 'login', component: () => import('./views/LoginView.vue'), meta: { public: true } },
  { path: '/', redirect: '/identity' },
  { path: '/identity', component: () => import('./views/IdentityList.vue') },
  { path: '/identity/:name', component: () => import('./views/IdentityDetail.vue'), props: true },
  { path: '/skills', component: () => import('./views/SkillsList.vue') },
  { path: '/skills/:slug', component: () => import('./views/SkillDetail.vue'), props: true },
  { path: '/agents', component: () => import('./views/AgentsList.vue') },
  { path: '/agents/:slug', component: () => import('./views/AgentDetail.vue'), props: true },
  { path: '/tasks', component: () => import('./views/TasksList.vue') },
  { path: '/tasks/:slug', component: () => import('./views/TaskDetail.vue'), props: true },
  { path: '/memory', component: () => import('./views/MemoryViewer.vue') },
  { path: '/memory/:date', component: () => import('./views/MemoryViewer.vue'), props: true },
  { path: '/kanban', component: () => import('./views/KanbanBoard.vue') },
  { path: '/sessions', component: () => import('./views/SessionsList.vue') },
  { path: '/sessions/:id', component: () => import('./views/SessionDetail.vue'), props: true },
  { path: '/profiles', component: () => import('./views/LaunchProfilesList.vue') },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (auth.loading) await auth.hydrate();
  if (!to.meta.public && !auth.user) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (to.name === 'login' && auth.user) return '/';
});

export default router;
