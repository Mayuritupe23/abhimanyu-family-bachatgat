<script setup>
import { onMounted, ref } from 'vue';
import Icon from '../components/Icon.vue';
import { m } from '../api.js';
import { t } from '../i18n.js';
import { day, initials, rupee } from '../util.js';

const d = ref(null);
const error = ref('');
const busy = ref('');
onMounted(async () => { try { d.value = await m('loans'); } catch (e) { error.value = e.message; } });

async function vote(loan, v) {
  busy.value = loan;
  error.value = '';
  try { d.value = await m('vote', { loan, vote: v }); } catch (e) { error.value = e.message; } finally { busy.value = ''; }
}
const statusPill = { Active: 'orange', Closed: 'green', Applied: 'blue', Approved: 'blue', Rejected: 'gray' };
</script>

<template>
  <div class="stack">
    <div v-if="error" class="error">{{ error }}</div>
    <div v-if="!d && !error" class="skeleton" />
    <template v-if="d">
      <section class="avail">
        <span>{{ t('You can take up to') }}</span>
        <b>{{ rupee(d.available) }}</b>
        <small>{{ t('Loan limit') }} {{ rupee(d.limit) }}</small>
      </section>

      <div class="sec"><h2>{{ t('My loans') }}</h2></div>
      <div v-if="!d.mine.length" class="card empty"><span>🤝</span>{{ t('No loan right now') }}</div>
      <article v-for="l in d.mine" :key="l.name" class="card">
        <div class="row">
          <div class="grow"><b>{{ rupee(l.amount) }}</b><div class="muted small">{{ l.name }} · {{ day(l.disbursed_on || l.application_date) }}</div></div>
          <span class="pill" :class="statusPill[l.status]">{{ t(l.status === 'Active' ? 'Left' : l.status) }} {{ l.status === 'Active' ? rupee(l.outstanding) : '' }}</span>
        </div>
        <template v-if="['Active', 'Closed'].includes(l.status)">
          <div class="track" style="margin-top:12px"><span :style="{ width: `${(l.repaid / l.amount) * 100}%` }" /></div>
          <div class="row small muted" style="margin-top:6px"><span class="grow">{{ t('Repaid') }} {{ rupee(l.repaid) }}</span><span v-if="l.due_date">{{ day(l.due_date) }}</span></div>
        </template>
      </article>

      <div class="sec"><h2>{{ t('Loan requests') }}</h2></div>
      <div v-if="!d.requests.length" class="card empty"><span>🗳️</span>{{ t('No requests to vote on') }}</div>
      <article v-for="r in d.requests" :key="r.name" class="card">
        <div class="row">
          <div class="av">{{ initials(r.member_name) }}</div>
          <div class="grow"><b>{{ r.member_name }}</b><div class="muted small">{{ rupee(r.amount) }} · {{ day(r.application_date) }}</div></div>
          <span class="muted small">👍 {{ r.yes }} · 👎 {{ r.no }}</span>
        </div>
        <p v-if="r.purpose" class="muted small" style="margin:10px 0 0">{{ r.purpose }}</p>
        <div class="votes">
          <button class="btn small yes" :class="{ picked: r.my_vote === 'Yes' }" :disabled="busy === r.name" @click="vote(r.name, 'Yes')"><Icon name="thumbs" :size="16" />{{ t('Yes') }}</button>
          <button class="btn small no" :class="{ picked: r.my_vote === 'No' }" :disabled="busy === r.name" @click="vote(r.name, 'No')">👎 {{ t('No') }}</button>
        </div>
        <p v-if="r.my_vote" class="muted small" style="margin:8px 0 0">{{ t('Your vote') }}: <b>{{ t(r.my_vote) }}</b></p>
      </article>
    </template>
  </div>
</template>

<style scoped>
.avail { border-radius: 20px; padding: 18px; color: #451a03; display: flex; flex-direction: column; gap: 2px; background: linear-gradient(135deg, #fde68a, #f59e0b); }
.avail span { font-size: 12.5px; font-weight: 700; } .avail b { font-size: 32px; font-weight: 800; } .avail small { font-weight: 600; opacity: .8; }
.votes { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
.votes .btn { width: 100%; }
.votes .picked { outline: 2.5px solid currentColor; }
</style>
