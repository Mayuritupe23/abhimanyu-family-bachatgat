<script setup>
import { onMounted, ref } from 'vue';
import { m } from '../api.js';
import { t } from '../i18n.js';
import { day, initials, monthName, rupee } from '../util.js';

const rows = ref(null);
const error = ref('');
const busy = ref('');
const big = ref('');
onMounted(async () => { try { rows.value = await m('approvals'); } catch (e) { error.value = e.message; } });

async function act(fn, payment, ask) {
  if (ask && !confirm(ask)) return;
  busy.value = payment;
  error.value = '';
  try { rows.value = await m(fn, { payment }); } catch (e) { error.value = e.message; } finally { busy.value = ''; }
}
</script>

<template>
  <div class="stack">
    <div v-if="error" class="error">{{ error }}</div>
    <div v-if="!rows && !error" class="skeleton" />
    <div v-if="rows && !rows.length" class="card empty"><span>🎉</span>{{ t('All payments approved') }}</div>
    <article v-for="r in rows || []" :key="r.name" class="card">
      <div class="row">
        <div class="av">{{ initials(r.member_name) }}</div>
        <div class="grow"><b>{{ r.member_name }}</b><div class="muted small">{{ monthName(r.month) }} · {{ day(r.payment_date) }}</div></div>
        <b class="amt">{{ rupee(r.total) }}</b>
      </div>
      <div class="parts muted small">
        {{ t('Saving') }} {{ rupee(r.saving) }}<template v-if="r.interest"> · {{ t('Interest') }} {{ rupee(r.interest) }}</template><template v-if="r.principal"> · {{ t('EMI') }} {{ rupee(r.principal) }}</template><template v-if="r.fine"> · {{ t('Fine') }} {{ rupee(r.fine) }}</template>
        <template v-if="r.utr"> · UTR {{ r.utr }}</template>
      </div>
      <img v-if="r.screenshot" :src="r.screenshot" class="shot" :class="{ open: big === r.name }" alt="" @click="big = big === r.name ? '' : r.name" />
      <div class="acts">
        <button class="btn small ghost" :disabled="busy === r.name" @click="act('reject', r.name, `${r.member_name}: ${t('Send back')}?`)">{{ t('Send back') }}</button>
        <button class="btn small" :disabled="busy === r.name" @click="act('approve', r.name)">✓ {{ t('Approve') }}</button>
      </div>
    </article>
  </div>
</template>

<style scoped>
.amt { font-size: 18px; }
.parts { margin-top: 10px; }
.shot { margin-top: 10px; width: 100%; max-height: 160px; object-fit: cover; border-radius: 12px; border: 1px solid var(--line); cursor: zoom-in; }
.shot.open { max-height: none; object-fit: contain; cursor: zoom-out; }
.acts { display: grid; grid-template-columns: 1fr 1.4fr; gap: 10px; margin-top: 12px; }
.acts .btn { width: 100%; }
</style>
