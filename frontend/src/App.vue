<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Icon from './components/Icon.vue';
import { store } from './store.js';
import { t } from './i18n.js';
import { initials } from './util.js';

const route = useRoute();
const router = useRouter();
const tabs = computed(() => [
  { to: '/', name: 'home', icon: 'home', label: 'Home' },
  { to: '/khata', name: 'khata', icon: 'book', label: 'Khata' },
  { to: '/loans', name: 'loans', icon: 'coins', label: 'Loans' },
  ...(store.boot?.can_approve ? [{ to: '/approve', name: 'approve', icon: 'check', label: 'Approve' }] : []),
  { to: '/me', name: 'me', icon: 'user', label: 'Me' },
]);
const showChrome = computed(() => route.name && route.name !== 'login');

// Install banner (Android/desktop Chrome); iPhone users get Add to Home Screen steps on Me.
const installEvent = ref(null);
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
onMounted(() => {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    let snoozed = false;
    try { snoozed = Date.now() - (+localStorage.getItem('afbg-install-later') || 0) < 7 * 864e5; } catch (err) { /* private mode */ }
    if (!snoozed) installEvent.value = e;
  });
});
async function install() {
  installEvent.value.prompt();
  await installEvent.value.userChoice;
  installEvent.value = null;
}
function later() {
  try { localStorage.setItem('afbg-install-later', Date.now()); } catch (err) { /* private mode */ }
  installEvent.value = null;
}
</script>

<template>
  <div class="shell" :class="{ standalone }">
    <header v-if="showChrome" class="appbar">
      <button v-if="route.meta.back" class="icon-btn" @click="router.back()" :aria-label="t('Home')"><Icon name="back" /></button>
      <img v-else class="brand" src="/assets/nova_core/images/logo.svg" alt="Abhimanyu Bachat Gat" />
      <h1 v-if="route.meta.title">{{ t(route.meta.title) }}</h1>
      <span class="grow" />
      <router-link to="/me" class="avatar">{{ initials(store.boot?.member?.member_name || store.boot?.full_name) }}</router-link>
    </header>

    <main :class="{ padded: showChrome }">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in"><component :is="Component" /></transition>
      </router-view>
    </main>

    <div v-if="installEvent && showChrome" class="install">
      <img src="/assets/nova_core/images/icon-192.png" alt="" />
      <b>{{ t('Install AFBG on your phone') }}</b>
      <button class="go" @click="install">{{ t('Install') }}</button>
      <button class="x" @click="later" aria-label="later"><Icon name="x" :size="16" /></button>
    </div>

    <nav v-if="showChrome" class="tabbar">
      <router-link v-for="tab in tabs" :key="tab.name" :to="tab.to" :class="{ on: route.name === tab.name }">
        <Icon :name="tab.icon" :size="22" />
        <span>{{ t(tab.label) }}</span>
      </router-link>
    </nav>
  </div>
</template>
