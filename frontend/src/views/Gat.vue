<script setup>
// Approver's side: the whole group's month, kept apart from the approver's own account (Home).
import { computed, onMounted, ref } from 'vue';
import Icon from '../components/Icon.vue';
import { m } from '../api.js';
import { t } from '../i18n.js';
import { day, initials, monthName, rupee, todayISO } from '../util.js';

const month = ref(todayISO().slice(0, 8) + '01');
const d = ref(null);
const error = ref('');
const busy = ref('');
const filter = ref('');
const big = ref('');
const lg = ref(null);  // loans: requests to decide, approved to pay out, running

async function load() {
  error.value = '';
  try {
    [d.value, lg.value] = await Promise.all([m('gat_month', { month: month.value }), m('gat_loans')]);
    if (!filter.value) filter.value = sent.value.length ? 'sent' : loanWork.value.length ? 'loans' : pending.value.length ? 'pending' : 'paid';
  } catch (e) { error.value = e.message; }
}
onMounted(load);
function shift(n) {
  const x = new Date(month.value + 'T00:00:00');
  x.setMonth(x.getMonth() + n);
  month.value = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-01`;
  d.value = null;
  filter.value = '';
  load();
}
const isCurrent = computed(() => month.value === todayISO().slice(0, 8) + '01');

const rows = computed(() => d.value?.rows || []);
const sent = computed(() => rows.value.filter((r) => r.state === 'draft'));
const pending = computed(() => rows.value.filter((r) => r.state === 'pending'));
const paid = computed(() => rows.value.filter((r) => r.state === 'paid'));
const loanWork = computed(() => (lg.value?.rows || []).filter((l) => ['Applied', 'Approved'].includes(l.status)));
const running = computed(() => (lg.value?.rows || []).filter((l) => l.status === 'Active'));
async function loanAct(fn, l, extra = {}) {
  busy.value = l.name;
  error.value = '';
  try { lg.value = await m(fn, { loan: l.name, ...extra }); } catch (e) { error.value = e.message; } finally { busy.value = ''; }
}
const decide = (l, status) => confirm(`${l.member_name} ${rupee(l.amount)}: ${t(status === 'Approved' ? 'Approve' : 'Reject')}?`) && loanAct('decide_loan', l, { status });
const giveMoney = (l) => confirm(`${t('Mark as given to')} ${l.member_name}: ${rupee(l.amount)}?`) && loanAct('disburse_loan', l);
const collected = computed(() => paid.value.reduce((a, r) => a + r.total, 0));
const shown = computed(() => ({ sent: sent.value, pending: pending.value, paid: paid.value }[filter.value] || []));

// fine as of today for someone who has not paid yet
function fineToday() {
  const late = Math.floor((new Date(todayISO()) - new Date(d.value.due_date)) / 864e5);
  return late > 0 ? d.value.late_fine_first_day + d.value.late_fine_per_day * (late - 1) : 0;
}
const owes = (r) => r.due + fineToday();

function whatsapp(r) {
  const first = r.member_name.split(' ')[0];
  const text = `Namaskar ${first} 🙏\nAFBG: ${monthName(month.value)} hapta ${rupee(owes(r))} baki aahe.\nLast date ${day(d.value.due_date)}.\nPay: ${location.origin}/afbg/pay`;
  const phone = String(r.mobile || '').replace(/\D/g, '').slice(-10);
  window.open(`https://wa.me/${phone ? '91' + phone : ''}?text=${encodeURIComponent(text)}`, '_blank');
}

async function act(fn, args, key) {
  busy.value = key;
  error.value = '';
  try {
    const res = await m(fn, args);
    if (res && res.rows) d.value = res; else await load();
  } catch (e) { error.value = e.message; } finally { busy.value = ''; }
}
const approve = (r) => act('approve', { payment: r.payment }, r.member);
const sendBack = (r) => confirm(`${r.member_name}: ${t('Send back')}?`) && act('reject', { payment: r.payment }, r.member);
function cash(r) {
  const emi = r.loan ? prompt(`${r.member_name} · ${t('EMI')} (${t('Left')} ${rupee(r.loan)})`, '0') : '0';
  if (emi === null) return;
  if (!confirm(`${r.member_name}: ${t('Cash received')} ${rupee(owes(r) + (+emi || 0))}?`)) return;
  act('record_cash', { member: r.member, month: month.value, emi: +emi || 0 }, r.member);
}
</script>

<template>
  <div class="stack">
    <div class="monthbar">
      <button class="icon-btn" @click="shift(-1)"><Icon name="back" /></button>
      <b>{{ monthName(month) }}</b>
      <button class="icon-btn flip" :disabled="isCurrent" @click="shift(1)"><Icon name="back" /></button>
    </div>

    <div v-if="error" class="error">{{ error }}</div>
    <div v-if="!d && !error" class="skeleton" />

    <template v-if="d">
      <section class="summary">
        <div class="prog">
          <div class="nums"><b>{{ paid.length }}</b>/{{ rows.length }} <span>{{ t('Paid') }}</span></div>
          <div class="track"><span :style="{ width: `${rows.length ? (paid.length / rows.length) * 100 : 0}%` }" /></div>
        </div>
        <div class="stat"><small>{{ t('Collected') }}</small><b>{{ rupee(collected) }}</b></div>
      </section>

      <div class="chips">
        <button :class="{ on: filter === 'sent', hot: sent.length }" @click="filter = 'sent'">{{ t('To check') }} <b>{{ sent.length }}</b></button>
        <button :class="{ on: filter === 'pending' }" @click="filter = 'pending'">{{ t('Not paid') }} <b>{{ pending.length }}</b></button>
        <button :class="{ on: filter === 'paid' }" @click="filter = 'paid'">{{ t('Paid') }} <b>{{ paid.length }}</b></button>
        <button :class="{ on: filter === 'loans', hot: loanWork.length }" @click="filter = 'loans'">{{ t('Loans') }} <b>{{ loanWork.length }}</b></button>
      </div>

      <div v-if="!shown.length && filter !== 'loans'" class="card empty"><span>🎉</span>{{ filter === 'sent' ? t('All payments approved') : filter === 'pending' ? t('Everyone has paid') : t('No payments yet') }}</div>

      <!-- sent by members: check and approve -->
      <article v-for="r in filter === 'sent' ? shown : []" :key="r.member" class="card">
        <div class="row">
          <div class="av">{{ initials(r.member_name) }}</div>
          <div class="grow"><b>{{ r.member_name }}</b><div class="muted small">{{ day(r.payment_date) }}</div></div>
          <b>{{ rupee(r.total) }}</b>
        </div>
        <div class="muted small parts">{{ t('Saving') }} {{ rupee(r.saving) }}<template v-if="r.interest"> · {{ t('Interest') }} {{ rupee(r.interest) }}</template><template v-if="r.emi"> · {{ t('EMI') }} {{ rupee(r.emi) }}</template><template v-if="r.fine"> · {{ t('Fine') }} {{ rupee(r.fine) }}</template></div>
        <img v-if="r.screenshot" :src="r.screenshot" class="shot" :class="{ open: big === r.member }" alt="" @click="big = big === r.member ? '' : r.member" />
        <div class="acts">
          <button class="btn small ghost" :disabled="busy === r.member" @click="sendBack(r)">{{ t('Send back') }}</button>
          <button class="btn small" :disabled="busy === r.member" @click="approve(r)">✓ {{ t('Approve') }}</button>
        </div>
      </article>

      <!-- not paid yet: remind or take cash -->
      <article v-for="r in filter === 'pending' ? shown : []" :key="r.member" class="card">
        <div class="row">
          <div class="av gray">{{ initials(r.member_name) }}</div>
          <div class="grow"><b>{{ r.member_name }}</b><div class="muted small">{{ t('Due') }} {{ rupee(owes(r)) }}<template v-if="fineToday()"> · {{ t('Fine') }} {{ rupee(fineToday()) }}</template></div></div>
        </div>
        <div class="acts">
          <button class="btn small wa" @click="whatsapp(r)">WhatsApp</button>
          <button class="btn small ghost" :disabled="busy === r.member" @click="cash(r)">💵 {{ t('Cash received') }}</button>
        </div>
      </article>

      <!-- done -->
      <article v-for="r in filter === 'paid' ? shown : []" :key="r.member" class="card paidrow">
        <div class="row">
          <div class="av">{{ initials(r.member_name) }}</div>
          <div class="grow"><b>{{ r.member_name }}</b><div class="muted small">{{ day(r.payment_date) }}</div></div>
          <div class="end"><b>{{ rupee(r.total) }}</b><span class="pill" :class="r.payment_mode === 'Cash' ? 'orange' : 'green'">{{ r.payment_mode || 'UPI' }}</span></div>
        </div>
      </article>

      <!-- loans: decide after the votes, then pay out -->
      <template v-if="filter === 'loans'">
        <div v-if="!loanWork.length" class="card empty"><span>🤝</span>{{ t('No loan request waiting') }}</div>
        <article v-for="l in loanWork" :key="l.name" class="card">
          <div class="row">
            <div class="av">{{ initials(l.member_name) }}</div>
            <div class="grow"><b>{{ l.member_name }}</b><div class="muted small">{{ day(l.application_date) }}</div></div>
            <b>{{ rupee(l.amount) }}</b>
          </div>
          <p v-if="l.purpose" class="muted small" style="margin:8px 0 0">“{{ l.purpose }}”</p>
          <div class="votebar">
            <span>👍 {{ l.yes }}</span><span>👎 {{ l.no }}</span><span class="muted">{{ lg.members - l.yes - l.no }} {{ t('not voted') }}</span>
          </div>
          <div v-if="l.status === 'Applied'" class="acts">
            <button class="btn small ghost" :disabled="busy === l.name" @click="decide(l, 'Rejected')">{{ t('Reject') }}</button>
            <button class="btn small" :disabled="busy === l.name" @click="decide(l, 'Approved')">✓ {{ t('Approve') }}</button>
          </div>
          <button v-else class="btn small give" :disabled="busy === l.name" @click="giveMoney(l)">💸 {{ t('Money given') }}</button>
        </article>
        <div v-if="running.length" class="sec"><h2>{{ t('Running loans') }}</h2></div>
        <article v-for="l in running" :key="l.name" class="card paidrow">
          <div class="row">
            <div class="av">{{ initials(l.member_name) }}</div>
            <div class="grow"><b>{{ l.member_name }}</b><div class="muted small">{{ l.due_date ? `${t('Close by')} ${day(l.due_date)}` : t('Old loan, no close date') }}</div></div>
            <b>{{ rupee(l.outstanding) }}</b>
          </div>
        </article>
      </template>

    </template>
  </div>
</template>

<style scoped>
.monthbar { display: flex; align-items: center; justify-content: space-between; background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 6px; }
.monthbar b { font-size: 16px; }
.flip svg { transform: rotate(180deg); }
.icon-btn:disabled { opacity: .35; }
.summary { display: flex; gap: 12px; align-items: stretch; border-radius: 20px; padding: 16px; color: #fff;
  background: radial-gradient(circle at 95% 0, rgba(245,158,11,.45), transparent 42%), linear-gradient(135deg, #16a34a, #14532d); }
.prog { flex: 1.3; display: flex; flex-direction: column; justify-content: center; gap: 8px; }
.nums { font-size: 15px; } .nums b { font-size: 28px; } .nums span { opacity: .85; font-size: 13px; }
.summary .track { background: rgba(255,255,255,.25); }
.summary .track span { background: #fbbf24; }
.stat { flex: 1; display: flex; flex-direction: column; justify-content: center; border-left: 1px solid rgba(255,255,255,.25); padding-left: 12px; }
.stat small { opacity: .85; } .stat b { font-size: 20px; }
.chips { display: flex; gap: 8px; }
.chips button { flex: 1; border: 1px solid var(--line); background: #fff; border-radius: 12px; padding: 9px 4px; font-weight: 700; font-size: 12.5px; color: var(--muted); }
.chips button b { display: inline-block; min-width: 20px; margin-left: 3px; padding: 0 6px; border-radius: 99px; background: var(--soft); color: var(--ink); }
.chips button.on { background: #14532d; border-color: #14532d; color: #fff; }
.chips button.on b { background: #fbbf24; color: #451a03; }
.chips button.hot:not(.on) b { background: var(--red); color: #fff; }
.parts { margin-top: 8px; }
.shot { margin-top: 10px; width: 100%; max-height: 150px; object-fit: cover; border-radius: 12px; border: 1px solid var(--line); }
.shot.open { max-height: none; object-fit: contain; }
.acts { display: grid; grid-template-columns: 1fr 1.3fr; gap: 10px; margin-top: 12px; }
.acts .btn { width: 100%; }
.wa { background: #25d366; box-shadow: none; }
.av.gray { background: var(--soft); color: var(--muted); }
.paidrow { padding: 12px 14px; }
.votebar { display: flex; gap: 14px; margin-top: 10px; font-size: 13px; font-weight: 700; }
.give { width: 100%; margin-top: 12px; }
.chips button { padding: 9px 2px; }
.end { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.link { font-weight: 700; color: var(--ink); }
</style>
