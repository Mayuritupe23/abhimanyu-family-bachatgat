<script setup>
import { ref } from 'vue';
import { login } from '../api.js';
import { t, lang, setLang } from '../i18n.js';

const usr = ref('');
const pwd = ref('');
const show = ref(false);
const busy = ref(false);
const error = ref('');

async function submit() {
  if (!usr.value.trim() || !pwd.value) return;
  busy.value = true;
  error.value = '';
  try {
    await login(usr.value.trim(), pwd.value);
    // full reload: the page Frappe renders after login carries the new CSRF token
    location.href = '/afbg/';
  } catch (e) {
    error.value = /Invalid|Incorrect|not found/i.test(e.message) ? 'Mobile number or password is wrong.' : e.message;
    busy.value = false;
  }
}
</script>

<template>
  <div class="login">
    <svg class="rings" viewBox="0 0 100 100"><g fill="none" stroke="#fff" stroke-width="1.5">
      <circle cx="50" cy="50" r="46" stroke-dasharray="14 6" /><circle cx="50" cy="50" r="36" stroke-dasharray="10 5" /><circle cx="50" cy="50" r="26" stroke-dasharray="7 4" /></g></svg>
    <div class="top">
      <img src="/assets/nova_core/images/emblem.svg" alt="" />
      <h1>Abhimanyu</h1>
      <p class="tag">Family Bachat Gat</p>
      <p class="mr">{{ t('Family savings, together') }}</p>
    </div>
    <form class="sheet" @submit.prevent="submit">
      <div v-if="error" class="error">{{ error }}</div>
      <label class="field">{{ t('Mobile or email') }}
        <input v-model="usr" class="input" inputmode="tel" autocomplete="username" placeholder="98XXXXXXXX" />
      </label>
      <label class="field">{{ t('Password') }}
        <div class="pwd">
          <input v-model="pwd" class="input" :type="show ? 'text' : 'password'" autocomplete="current-password" placeholder="••••••••" />
          <button type="button" @click="show = !show">{{ show ? t('Hide') : t('Show') }}</button>
        </div>
      </label>
      <button class="btn" :disabled="busy || !usr.trim() || !pwd">{{ busy ? t('Signing in…') : t('Sign in') }}</button>
      <button type="button" class="lang" @click="setLang(lang === 'en' ? 'mr' : 'en')">{{ lang === 'en' ? 'मराठी' : 'English' }}</button>
    </form>
  </div>
</template>

<style scoped>
.login { min-height: 100vh; position: relative; overflow: hidden; display: flex; flex-direction: column; color: #fff;
  background: radial-gradient(circle at 90% 5%, rgba(245,158,11,.55), transparent 40%), linear-gradient(160deg, #16a34a, #14532d 70%); }
.rings { position: absolute; width: 340px; right: -120px; top: -90px; opacity: .15; }
.top { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 20px 28px; text-align: center; }
.top img { width: 88px; height: 88px; border-radius: 24px; box-shadow: 0 14px 30px rgba(0,0,0,.25); }
h1 { margin: 18px 0 0; font-size: 30px; font-weight: 800; letter-spacing: -.5px; }
.tag { margin: 2px 0 0; font-weight: 700; letter-spacing: 4px; text-transform: uppercase; font-size: 12px; color: #fde68a; }
.mr { margin: 10px 0 0; opacity: .85; }
.sheet { background: var(--bg); color: var(--ink); border-radius: 26px 26px 0 0; padding: 26px 20px calc(26px + env(safe-area-inset-bottom));
  display: flex; flex-direction: column; gap: 16px; }
.pwd { position: relative; }
.pwd button { position: absolute; right: 8px; top: 8px; height: 32px; border: 0; border-radius: 8px; background: var(--soft); font-size: 12px; font-weight: 700; padding: 0 10px; }
.lang { border: 0; background: none; color: var(--g2); font-weight: 700; }
</style>
