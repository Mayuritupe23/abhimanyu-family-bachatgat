import { createRouter, createWebHistory } from 'vue-router';
import { store, loadBoot } from './store.js';

const routes = [
  { path: '/login', name: 'login', component: () => import('./views/Login.vue'), meta: { public: true } },
  { path: '/', name: 'home', component: () => import('./views/Home.vue') },
  { path: '/pay', name: 'pay', component: () => import('./views/Pay.vue'), meta: { title: 'Pay Hapta', back: true } },
  { path: '/khata', name: 'khata', component: () => import('./views/Khata.vue'), meta: { title: 'My Khata' } },
  { path: '/loans/apply', name: 'loan-apply', component: () => import('./views/LoanApply.vue'), meta: { title: 'Ask for a loan', back: true } },
  { path: '/loans', name: 'loans', component: () => import('./views/Loans.vue'), meta: { title: 'Loans' } },
  { path: '/gat', name: 'gat', component: () => import('./views/Gat.vue'), meta: { title: 'Gat Tracker', approver: true } },
  { path: '/approve', redirect: '/gat' },
  { path: '/me', name: 'me', component: () => import('./views/Me.vue'), meta: { title: 'Me' } },
  { path: '/:rest(.*)*', redirect: '/' },
];

const router = createRouter({ history: createWebHistory('/afbg/'), routes, scrollBehavior: () => ({ top: 0 }) });

router.beforeEach(async (to) => {
  if (store.boot === undefined) await loadBoot();
  if (to.meta.public) return store.boot ? { name: 'home' } : true;
  if (!store.boot) return { name: 'login' };
  if (to.meta.approver && !store.boot.can_approve) return { name: 'home' };
  return true;
});

// coming back to the tab: a session that ended elsewhere goes to Login
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible') return;
  await loadBoot();
  if (!store.boot && router.currentRoute.value.name !== 'login') router.replace({ name: 'login' });
});

export default router;
