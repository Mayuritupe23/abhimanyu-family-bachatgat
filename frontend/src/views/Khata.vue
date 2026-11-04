<script setup>
import { onMounted, ref } from 'vue';
import { m } from '../api.js';
import { t } from '../i18n.js';
import { day, monthName, rupee } from '../util.js';

const d = ref(null);
const error = ref('');
const open = ref(null);
onMounted(async () => { try { d.value = await m('passbook'); } catch (e) { error.value = e.message; } });
</script>

<template>
  <div class="stack">
    <div v-if="error" class="error">{{ error }}</div>
    <div v-if="!d && !error" class="skeleton" />
    <template v-if="d">
      <section class="sum">
        <span>{{ t('My savings') }}</span>
        <b>{{ rupee(d.savings) }}</b>
        <small>{{ t('Interest') }} {{ rupee(d.interest) }} · {{ t('Fine') }} {{ rupee(d.fines) }}</small>
      </section>

      <div v-if="!d.rows.length" class="empty"><span>📒</span>{{ t('No payments yet') }}</div>
      <article v-for="r in d.rows" :key="r.name" class="card entry" @click="open = open === r.name ? null : r.name">
        <div class="row">
          <div class="cal" :class="{ x: r.is_extra }"><b>{{ r.is_extra ? '+' : monthName(r.month, false).slice(0, 3) }}</b><small>{{ String(r.month).slice(2, 4) }}</small></div>
          <div class="grow">
            <b>{{ r.is_extra ? t('Extra EMI') : monthName(r.month) }}</b>
            <div class="muted small">{{ t('Paid on') }} {{ day(r.payment_date) }}</div>
          </div>
          <div class="end">
            <b>{{ rupee(r.total) }}</b>
            <span class="pill" :class="r.docstatus === 1 ? 'green' : 'blue'">{{ r.docstatus === 1 ? t('Paid') : t('Sent') }}</span>
          </div>
        </div>
        <div v-if="open === r.name" class="more">
          <div class="line"><span>{{ t('Saving') }}</span><b>{{ rupee(r.saving) }}</b></div>
          <div v-if="r.interest" class="line"><span>{{ t('Interest') }}</span><b>{{ rupee(r.interest) }}</b></div>
          <div v-if="r.principal" class="line"><span>{{ t('EMI') }}</span><b>{{ rupee(r.principal) }}</b></div>
          <div v-if="r.fine" class="line"><span>{{ t('Fine') }}</span><b>{{ rupee(r.fine) }}</b></div>
        </div>
      </article>
      <article v-if="d.opening" class="card entry">
        <div class="row"><div class="cal"><b>⭐</b></div><div class="grow"><b>{{ t('Opening') }}</b></div><b>{{ rupee(d.opening) }}</b></div>
      </article>
    </template>
  </div>
</template>

<style scoped>
.sum { border-radius: 20px; padding: 18px; color: #fff; display: flex; flex-direction: column; gap: 2px;
  background: radial-gradient(circle at 95% 0, rgba(245,158,11,.45), transparent 42%), linear-gradient(135deg, #16a34a, #14532d); }
.sum span { font-size: 12.5px; opacity: .9; font-weight: 600; } .sum b { font-size: 34px; font-weight: 800; } .sum small { opacity: .85; }
.entry { padding: 12px 14px; cursor: pointer; }
.cal { width: 46px; height: 46px; flex: none; border-radius: 12px; background: var(--soft); display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.1; }
.cal.x { background: #fffbeb; color: #b45309; }
.cal b { font-size: 13px; } .cal small { color: var(--muted); font-size: 11px; }
.end { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.more { margin-top: 8px; border-top: 1px solid var(--line); padding-top: 4px; }
</style>
