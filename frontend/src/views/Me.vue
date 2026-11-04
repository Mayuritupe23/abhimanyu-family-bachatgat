<script setup>
import { computed, ref } from 'vue';
import Icon from '../components/Icon.vue';
import { logout, m, squarePhoto, upload } from '../api.js';
import Avatar from '../components/Avatar.vue';
import { store } from '../store.js';
import { lang, setLang, t } from '../i18n.js';
import { rupee } from '../util.js';

const b = computed(() => store.boot);
const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

async function switchLang(l) {
  setLang(l);
  m('set_language', { lang: l }).catch(() => {});
}
// profile photo: square-cropped and uploaded as a public file so every member's list can show it
const photoBusy = ref(false);
const photoError = ref('');
async function pickPhoto(e) {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  photoBusy.value = true;
  photoError.value = '';
  try {
    const url = await upload(await squarePhoto(f), false);
    store.boot.photo = await m('set_photo', { file_url: url });
  } catch (err) { photoError.value = err.message; } finally { photoBusy.value = false; }
}
async function removePhoto() {
  if (!confirm(t('Remove profile photo?'))) return;
  await m('set_photo', {});
  store.boot.photo = null;
}

// change password: the member picks their own; Frappe's password policy decides what is too weak
const pw = ref({ open: false, old: '', neu: '', again: '', show: false, busy: false, error: '', done: false });
const pwOk = computed(() => pw.value.old && pw.value.neu.length >= 4 && pw.value.neu === pw.value.again);
async function changePassword() {
  const p = pw.value;
  p.busy = true;
  p.error = '';
  try {
    await m('change_password', { old_password: p.old, new_password: p.neu });
    p.done = true;
    // Frappe may end the session after a password change: sign in again with the new one
    setTimeout(async () => { await logout(); location.href = '/afbg/login'; }, 2500);
  } catch (e) {
    p.error = /Current password is wrong/.test(e.message) ? t('Current password is wrong.')
      : /common|guess|easy|password|weak/i.test(e.message) ? t('This password is too easy to guess. Try a name with a number, like Pooja@1990.') : e.message;
  } finally { p.busy = false; }
}

async function out() {
  await logout();
  location.href = '/afbg/login';
}
</script>

<template>
  <div class="stack">
    <section class="card me">
      <label class="pic" :class="{ busy: photoBusy }">
        <Avatar :name="b.member?.member_name || b.full_name" :photo="b.photo" :size="72" />
        <span class="cam"><Icon name="camera" :size="15" /></span>
        <input type="file" accept="image/*" hidden @change="pickPhoto" />
      </label>
      <div>
        <b>{{ b.member?.member_name || b.full_name }}</b>
        <span class="role" :class="{ office: b.member?.designation && b.member.designation !== 'Member' }">{{ t(b.member?.designation || 'Member') }}</span>
        <div class="muted small">{{ b.member?.mobile || b.user }}</div>
        <div class="small photo-acts">
          <span class="muted">{{ photoBusy ? t('Uploading…') : b.photo ? t('Tap the photo to change it') : t('Tap the circle to add your photo') }}</span>
          <button v-if="b.photo && !photoBusy" class="linkbtn" @click="removePhoto">{{ t('Remove') }}</button>
        </div>
        <div v-if="photoError" class="error small">{{ photoError }}</div>
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

    <section class="card">
      <button class="row link pwbtn" @click="pw.open = !pw.open"><Icon name="key" /><b class="grow">{{ t('Change password') }}</b>{{ pw.open ? '▲' : '▼' }}</button>
      <div v-if="pw.open" class="stack pwform">
        <div v-if="pw.done" class="okmsg">✓ {{ t('Password changed. Please sign in with the new password.') }}</div>
        <template v-else>
          <div v-if="pw.error" class="error">{{ pw.error }}</div>
          <label class="field">{{ t('Current password') }}<input v-model="pw.old" class="input" :type="pw.show ? 'text' : 'password'" autocomplete="current-password" /></label>
          <label class="field">{{ t('New password') }}<input v-model="pw.neu" class="input" :type="pw.show ? 'text' : 'password'" autocomplete="new-password" /></label>
          <label class="field">{{ t('New password again') }}<input v-model="pw.again" class="input" :type="pw.show ? 'text' : 'password'" autocomplete="new-password" /></label>
          <p v-if="pw.neu && pw.neu.length < 4" class="small warn">{{ t('At least 4 characters') }}</p>
          <p v-else-if="pw.again && pw.neu !== pw.again" class="small warn">{{ t('The two new passwords are not the same') }}</p>
          <label class="showpw"><input v-model="pw.show" type="checkbox" /> {{ t('Show passwords') }}</label>
          <button class="btn" :disabled="!pwOk || pw.busy" @click="changePassword">{{ pw.busy ? t('Saving…') : t('Change password') }}</button>
        </template>
      </div>
    </section>

    <section v-if="ios && !standalone" class="card ios">
      <b>{{ t('Install the Bachat Gat app on your phone') }}</b>
      <p class="muted small">Safari → Share ⬆️ → “Add to Home Screen”</p>
    </section>

    <button class="card row link out" @click="out"><Icon name="logout" /><span class="grow">{{ t('Log out') }}</span></button>
    <p class="muted small ver">Abhimanyu Family Bachat Gat</p>
  </div>
</template>

<style scoped>
.me { display: flex; align-items: center; gap: 14px; }
.role { display: inline-block; margin: 3px 0 2px; padding: 2px 10px; border-radius: 99px; font-size: 12px; font-weight: 800; background: var(--soft); color: var(--muted); }
.role.office { background: linear-gradient(90deg, #fbbf24, #f59e0b); color: #451a03; }
.pic { position: relative; flex: none; cursor: pointer; }
.pic.busy { opacity: .5; }
.cam { position: absolute; right: -2px; bottom: -2px; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center;
  background: var(--g2); color: #fff; box-shadow: 0 0 0 3px #fff; }
.photo-acts { display: flex; gap: 10px; align-items: center; margin-top: 4px; }
.linkbtn { border: 0; background: none; padding: 0; color: var(--red); font-weight: 700; font-size: 12px; }
.me b { font-size: 18px; }
.seg { display: flex; background: var(--soft); border-radius: 10px; padding: 3px; }
.seg button { border: 0; background: none; padding: 6px 12px; border-radius: 8px; font-weight: 700; color: var(--muted); }
.seg button.on { background: #fff; color: var(--ink); box-shadow: 0 1px 3px rgba(0,0,0,.1); }
.link { font-weight: 700; width: 100%; text-align: left; }
.out { color: var(--red); }
.pwbtn { border: 0; background: none; padding: 0; color: var(--ink); font: inherit; }
.pwform { margin-top: 14px; gap: 12px; }
.warn { margin: -4px 0 0; color: var(--red); font-weight: 600; }
.showpw { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); font-weight: 600; }
.okmsg { background: #dcfce7; color: #166534; border-radius: 12px; padding: 12px; font-weight: 700; }
.ver { text-align: center; }
</style>
