<script setup>
import { computed } from 'vue';
import Icon from '../components/Icon.vue';
import { logout, m } from '../api.js';
import { store } from '../store.js';
import { lang, setLang, t } from '../i18n.js';
import { initials, rupee } from '../util.js';

const b = computed(() => store.boot);
const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

async function switchLang(l) {
  setLang(l);
  m('set_language', { lang: l }).catch(() => {});
}
async function out() {
  await logout();
  location.href = '/afbg/login';
}
</script>

<template>
  <div class="stack">
    <section class="card me">
      <div class="av big">{{ initials(b.member?.member_name || b.full_name) }}</div>
      <div>
        <b>{{ b.member?.member_name || b.full_name }}</b>
        <div class="muted small">{{ b.member?.designation }} · {{ b.member?.mobile || b.user }}</div>
      </div>
    </section>

    <section class="card">
      <div class="row"><Icon name="globe" /><b class="grow">{{ t('Language') }}</b>
        <div class="seg">
          <button :class="{ on: lang === 'en' }" @click="switchLang('en')">English</button>
          <button :class="{ on: lang === 'mr' }" @click="switchLang('mr')">मराठी</button>
        </div>
      </div>
    </section>

    <section class="card">
      <b>{{ t('Group rules') }}</b>
      <div class="line"><span>{{ t('Monthly saving') }}</span><b>{{ rupee(b.rules.monthly_saving) }}</b></div>
      <div class="line"><span>{{ t('Due by') }}</span><b>{{ b.rules.due_day }} {{ t('of every month') }}</b></div>
      <div class="line"><span>{{ t('Late fine') }}</span><b>{{ rupee(b.rules.fine_first) }} + {{ rupee(b.rules.fine_per_day) }} {{ t('per day') }}</b></div>
      <div class="line"><span>{{ t('Interest') }}</span><b>{{ b.rules.interest_rate }}% {{ t('per month') }}</b></div>
      <div class="line"><span>{{ t('Loan limit') }}</span><b>{{ rupee(b.rules.loan_limit) }}</b></div>
    </section>

    <section v-if="ios && !standalone" class="card ios">
      <b>{{ t('Install AFBG on your phone') }}</b>
      <p class="muted small">Safari → Share ⬆️ → “Add to Home Screen”</p>
    </section>

    <a v-if="b.sees_all" href="/desk/gat" class="card row link"><Icon name="desk" /><span class="grow">{{ t('Open full desk') }}</span>→</a>
    <button class="card row link out" @click="out"><Icon name="logout" /><span class="grow">{{ t('Log out') }}</span></button>
    <p class="muted small ver">AFBG · Abhimanyu Family Bachat Gat</p>
  </div>
</template>

<style scoped>
.me { display: flex; align-items: center; gap: 14px; }
.av.big { width: 58px; height: 58px; font-size: 19px; }
.me b { font-size: 18px; }
.seg { display: flex; background: var(--soft); border-radius: 10px; padding: 3px; }
.seg button { border: 0; background: none; padding: 6px 12px; border-radius: 8px; font-weight: 700; color: var(--muted); }
.seg button.on { background: #fff; color: var(--ink); box-shadow: 0 1px 3px rgba(0,0,0,.1); }
.link { font-weight: 700; width: 100%; text-align: left; }
.out { color: var(--red); }
.ver { text-align: center; }
</style>
