<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import Icon from '../components/Icon.vue';
import { m } from '../api.js';
import { t } from '../i18n.js';
import { day, initials, rupee } from '../util.js';

const route = useRoute();
const d = ref(null);
const error = ref('');
const busy = ref('');
const justApplied = ref(!!route.query.applied);
onMounted(async () => { try { d.value = await m('loans'); } catch (e) { error.value = e.message; } });

async function run(fn, args, key) {
  busy.value = key;
  error.value = '';
  try { d.value = await m(fn, args); } catch (e) { error.value = e.message; } finally { busy.value = ''; }
}
const vote = (loan, v) => run('vote', { loan, vote: v }, loan);
const withdraw = (l) => confirm(`${t('Withdraw request')} ${rupee(l.amount)}?`) && run('withdraw_loan', { loan: l.name }, l.name);

// where an application stands: asked -> voting -> approved -> money given
const stage = (l) => ({ Applied: 1, Approved: 2, Active: 3, Closed: 3 }[l.status] || 0);
const statusPill = { Active: 'orange', Closed: 'green', Applied: 'blue', Approved: 'blue', Rejected: 'gray' };
const statusText = { Active: 'Running', Closed: 'Closed', Applied: 'Voting', Approved: 'Approved', Rejected: 'Not approved' };
</script>

<template>
  <div class="stack">
    <div v-if="error" class="error">{{ error }}</div>
    <div v-if="!d && !error" class="skeleton" />
    <template v-if="d">
      <div v-if="justApplied" class="card sent" @click="justApplied = false">✓ {{ t('Request sent. Members will vote on it.') }}</div>

      <section class="avail">
        <div class="grow">
          <span>{{ t('You can take up to') }}</span>
          <b>{{ rupee(d.available) }}</b>
          <small>{{ t('Loan limit') }} {{ rupee(d.limit) }}</small>
        </div>
        <router-link v-if="d.available && !d.blocked" to="/loans/apply" class="ask">{{ t('Ask for a loan') }} →</router-link>
      </section>
      <div v-if="d.blocked" class="error">{{ d.blocked }}</div>

      <div class="sec"><h2>{{ t('My loans') }}</h2></div>
      <div v-if="!d.mine.length" class="card empty"><span>🤝</span>{{ t('No loan right now') }}</div>
      <article v-for="l in d.mine" :key="l.name" class="card">
        <div class="row">
          <div class="grow"><b class="amt">{{ rupee(l.amount) }}</b><div class="muted small">{{ l.purpose || l.name }} · {{ day(l.disbursed_on || l.application_date) }}</div></div>
          <span class="pill" :class="statusPill[l.status]">{{ t(statusText[l.status] || l.status) }}</span>
        </div>

        <!-- application still moving -->
        <template v-if="['Applied', 'Approved'].includes(l.status)">
          <ol class="flow">
            <li :class="{ done: stage(l) >= 1 }">{{ t('Asked') }}</li>
            <li :class="{ done: stage(l) >= 2, now: stage(l) === 1 }">{{ t('Voting') }} · 👍 {{ l.yes }} 👎 {{ l.no }}</li>
            <li :class="{ done: stage(l) >= 3, now: stage(l) === 2 }">{{ t('Approved') }}</li>
            <li :class="{ now: false }">{{ t('Money given') }}</li>
          </ol>
          <p v-if="l.status === 'Approved'" class="muted small">{{ t('Approved. The treasurer will give you the money.') }}</p>
          <button v-if="l.status === 'Applied'" class="btn ghost small" :disabled="busy === l.name" @click="withdraw(l)">{{ t('Withdraw request') }}</button>
        </template>

        <!-- running or closed -->
        <template v-if="['Active', 'Closed'].includes(l.status)">
          <div class="track" style="margin-top:12px"><span :style="{ width: `${(l.repaid / l.amount) * 100}%` }" /></div>
          <div class="row small muted" style="margin-top:6px">
            <span class="grow">{{ t('Repaid') }} {{ rupee(l.repaid) }}</span>
            <b v-if="l.status === 'Active'" class="left">{{ t('Left') }} {{ rupee(l.outstanding) }}</b>
          </div>
          <div v-if="l.status === 'Active'" class="row small muted" style="margin-top:4px">
            <span class="grow">{{ l.due_date ? `${t('Close by')} ${day(l.due_date)}` : t('Old loan, no close date') }}</span>
            <router-link to="/pay" class="link">{{ t('Repay') }} →</router-link>
          </div>
        </template>
      </article>

      <div class="sec"><h2>{{ t('Loan requests') }}</h2></div>
      <p class="muted small" style="margin:-6px 2px 0">{{ t('Vote on other members\' requests. You can change your vote until it is decided.') }}</p>
      <div v-if="!d.requests.length" class="card empty"><span>🗳️</span>{{ t('No requests to vote on') }}</div>
      <article v-for="r in d.requests" :key="r.name" class="card">
        <div class="row">
          <div class="av">{{ initials(r.member_name) }}</div>
          <div class="grow"><b>{{ r.member_name }}</b><div class="muted small">{{ rupee(r.amount) }} · {{ day(r.application_date) }}</div></div>
          <span class="muted small">👍 {{ r.yes }} · 👎 {{ r.no }}</span>
        </div>
        <p v-if="r.purpose" class="purpose">“{{ r.purpose }}”</p>
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
.sent { background: #dcfce7; border-color: #bbf7d0; color: #166534; font-weight: 700; }
.avail { border-radius: 20px; padding: 16px 18px; color: #451a03; display: flex; align-items: center; gap: 12px; background: linear-gradient(135deg, #fde68a, #f59e0b); }
.avail span { display: block; font-size: 12.5px; font-weight: 700; } .avail b { display: block; font-size: 30px; font-weight: 800; } .avail small { font-weight: 600; opacity: .8; }
.ask { flex: none; background: #14532d; color: #fff; border-radius: 12px; padding: 10px 12px; font-weight: 800; font-size: 13px; }
.amt { font-size: 18px; }
.flow { list-style: none; margin: 12px 0 8px; padding: 0 0 0 4px; display: flex; flex-direction: column; gap: 8px; }
.flow li { position: relative; padding-left: 22px; font-size: 13px; color: var(--muted); }
.flow li::before { content: ''; position: absolute; left: 0; top: 3px; width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--line); background: #fff; }
.flow li.done { color: var(--ink); font-weight: 600; }
.flow li.done::before { background: var(--g1); border-color: var(--g1); }
.flow li.now { color: var(--g3); font-weight: 800; }
.flow li.now::before { border-color: var(--g1); box-shadow: 0 0 0 3px rgba(22,163,74,.2); }
.left { color: #c2410c; }
.link { color: var(--g2); font-weight: 800; }
.purpose { margin: 10px 0 0; font-size: 13px; color: var(--ink); font-style: italic; }
.votes { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
.votes .btn { width: 100%; }
.votes .picked { outline: 2.5px solid currentColor; }
</style>
