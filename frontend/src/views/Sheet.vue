<script setup>
// The month's sheet for everyone, same as the group's WhatsApp images:
//   Paise Bharna - what each member has to pay this month
//   Statement    - what came in, interest, EMI, fine and the loan left after the month
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import Icon from '../components/Icon.vue';
import { m } from '../api.js';
import { csvBlob, demandSpec, imageBlob, saveFile, shareImage, statementSpec } from '../sheetExport.js';
import { t } from '../i18n.js';
import { monthName, rupee, todayISO } from '../util.js';

const route = useRoute();
const tab = ref(route.query.tab === 'statement' ? 'statement' : 'demand');
// the statement is a month-end report, so it opens on last month; the payment sheet on this month
function startMonth() {
  const x = new Date(todayISO().slice(0, 8) + '01T00:00:00');
  if (tab.value === 'statement') x.setMonth(x.getMonth() - 1);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-01`;
}
const month = ref(startMonth());
const d = ref(null);
const error = ref('');

async function load() {
  error.value = '';
  d.value = null;
  try { d.value = await m('sheet', { month: month.value }); } catch (e) { error.value = e.message; }
}
onMounted(load);
function shift(n) {
  const x = new Date(month.value + 'T00:00:00');
  x.setMonth(x.getMonth() + n);
  month.value = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-01`;
  load();
}
const isCurrent = computed(() => month.value === todayISO().slice(0, 8) + '01');
const rows = computed(() => d.value?.rows || []);
const paid = (r) => r.state === 'paid';
const n = (v) => Math.round(v || 0).toLocaleString('en-IN');

const demandTotals = computed(() => ({
  loan: rows.value.reduce((a, r) => a + r.loan, 0),
  interest: rows.value.reduce((a, r) => a + r.interest, 0),
  monthly: rows.value.reduce((a, r) => a + r.saving, 0),
  pay: rows.value.reduce((a, r) => a + r.saving + r.interest, 0),
}));
const stTotals = computed(() => {
  const p = rows.value.filter(paid);
  return {
    shares: p.reduce((a, r) => a + r.saving, 0), loan: rows.value.reduce((a, r) => a + r.loan, 0),
    interest: p.reduce((a, r) => a + r.interest, 0), emi: p.reduce((a, r) => a + r.emi, 0),
    fine: p.reduce((a, r) => a + r.fine, 0), total: p.reduce((a, r) => a + r.total, 0),
    balance: rows.value.reduce((a, r) => a + (paid(r) ? r.balance : r.loan), 0),
  };
});
// open the sheet as a picture first; download / share only from there
//   one  = the sheet on screen, month = Paise Bharna + Statement together
const view = ref(null); // { specs, name, url }
async function openView(which) {
  const specs = which === 'month' ? [demandSpec(d.value), statementSpec(d.value)]
    : [tab.value === 'statement' ? statementSpec(d.value) : demandSpec(d.value)];
  const name = which === 'month' ? `gat-${d.value.month.slice(0, 7)}` : specs[0].file;
  view.value = { specs, name, url: URL.createObjectURL(await imageBlob(specs)) };
}
function closeView() {
  URL.revokeObjectURL(view.value.url);
  view.value = null;
}
const busyExport = ref('');
async function exportAs(kind) {
  const { specs, name } = view.value;
  busyExport.value = kind;
  try {
    if (kind === 'share') await shareImage(specs, name);
    else if (kind === 'image') saveFile(await imageBlob(specs), `${name}.png`);
    else saveFile(csvBlob(specs), `${name}.csv`);
  } finally { busyExport.value = ''; }
}
const canShare = typeof navigator !== 'undefined' && !!navigator.canShare;
const notPaid = computed(() => rows.value.filter((r) => !paid(r)).map((r) => r.member_name.split(' ')[0]));
</script>

<template>
  <div class="stack">
    <div class="monthbar">
      <button class="icon-btn" @click="shift(-1)"><Icon name="back" /></button>
      <b>{{ monthName(month) }}</b>
      <button class="icon-btn flip" :disabled="isCurrent" @click="shift(1)"><Icon name="back" /></button>
    </div>
    <div class="seg">
      <button :class="{ on: tab === 'demand' }" @click="tab = 'demand'">📢 {{ t('Paise Bharna') }}</button>
      <button :class="{ on: tab === 'statement' }" @click="tab = 'statement'">📄 {{ t('Statement') }}</button>
    </div>

    <div v-if="error" class="error">{{ error }}</div>
    <div v-if="!d && !error" class="skeleton" />

    <div v-if="d" class="exports">
      <button class="ex" @click="openView('one')"><Icon name="image" :size="18" />{{ t('View sheet') }}</button>
      <button class="ex month" @click="openView('month')"><Icon name="table" :size="18" />{{ t('Whole month') }}</button>
    </div>

    <div v-if="view" class="viewer" @click.self="closeView">
      <div class="vbox">
        <div class="vhead"><b>{{ view.specs.length > 1 ? t('Whole month') : view.specs[0].title }}</b>
          <button class="icon-btn" @click="closeView">✕</button></div>
        <div class="vimg"><img :src="view.url" alt=""></div>
        <div class="exports">
          <button v-if="canShare" class="ex share" :disabled="!!busyExport" @click="exportAs('share')"><Icon name="share" :size="18" />{{ t('Share') }}</button>
          <button class="ex" :disabled="!!busyExport" @click="exportAs('image')"><Icon name="image" :size="18" />{{ t('Download image') }}</button>
          <button class="ex" :disabled="!!busyExport" @click="exportAs('csv')"><Icon name="table" :size="18" />Excel</button>
        </div>
      </div>
    </div>

    <template v-if="d && tab === 'demand'">
      <p class="muted small note">{{ t('What each member has to pay this month') }} · {{ t('Interest') }} {{ d.interest_rate }}% · {{ t('Last date') }} {{ d.due_date.slice(8, 10) }}</p>
      <div class="card tablewrap">
        <table>
          <thead><tr><th class="name">{{ t('Name') }}</th><th>{{ t('Loan') }}</th><th>{{ t('Interest') }}</th><th>{{ t('Monthly') }}</th><th>{{ t('To pay') }}</th></tr></thead>
          <tbody>
            <tr v-for="r in rows" :key="r.member" :class="{ me: r.me }">
              <td class="name">{{ r.member_name }}</td><td :class="{ blue: r.loan }">{{ n(r.loan) }}</td><td>{{ n(r.interest) }}</td>
              <td>{{ n(r.saving) }}</td><td class="b">{{ n(r.saving + r.interest) }}</td>
            </tr>
          </tbody>
          <tfoot><tr><td class="name">{{ t('Total') }}</td><td>{{ n(demandTotals.loan) }}</td><td>{{ n(demandTotals.interest) }}</td><td>{{ n(demandTotals.monthly) }}</td><td>{{ n(demandTotals.pay) }}</td></tr></tfoot>
        </table>
      </div>
      <p class="muted small note">{{ t('Add any EMI you want to repay on top. A late payment adds a fine.') }}</p>
    </template>

    <template v-if="d && tab === 'statement'">
      <div class="sumrow">
        <div><small>{{ t('Collected') }}</small><b>{{ rupee(stTotals.total) }}</b></div>
        <div><small>{{ t('Loan left') }}</small><b>{{ rupee(stTotals.balance) }}</b></div>
      </div>
      <div class="card tablewrap">
        <table>
          <thead><tr><th class="name">{{ t('Name') }}</th><th>{{ t('Shares') }}</th><th>{{ t('Loan') }}</th><th>{{ t('Interest') }}</th><th>EMI</th><th>{{ t('Fine') }}</th><th>{{ t('Total') }}</th><th>{{ t('Balance') }}</th></tr></thead>
          <tbody>
            <tr v-for="r in rows" :key="r.member" :class="{ me: r.me, unpaid: !paid(r) }">
              <td class="name">{{ r.member_name }}</td>
              <td>{{ paid(r) ? n(r.saving) : '—' }}</td><td>{{ n(r.loan) }}</td><td>{{ paid(r) ? n(r.interest) : '—' }}</td>
              <td>{{ paid(r) ? n(r.emi) : '—' }}</td><td :class="{ red: r.fine }">{{ paid(r) ? n(r.fine) : '—' }}</td>
              <td class="b">{{ paid(r) ? n(r.total) : '—' }}</td><td :class="{ blue: paid(r) ? r.balance : r.loan }">{{ n(paid(r) ? r.balance : r.loan) }}</td>
            </tr>
          </tbody>
          <tfoot><tr><td class="name">{{ t('Total') }}</td><td>{{ n(stTotals.shares) }}</td><td>{{ n(stTotals.loan) }}</td><td>{{ n(stTotals.interest) }}</td><td>{{ n(stTotals.emi) }}</td><td>{{ n(stTotals.fine) }}</td><td>{{ n(stTotals.total) }}</td><td>{{ n(stTotals.balance) }}</td></tr></tfoot>
        </table>
      </div>
      <p v-if="notPaid.length" class="muted small note">{{ t('Not paid yet') }}: {{ notPaid.join(', ') }}</p>
      <p v-else class="ok small note">✓ {{ t('Everyone has paid') }}</p>
    </template>
  </div>
</template>

<style scoped>
.monthbar { display: flex; align-items: center; justify-content: space-between; background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 6px; }
.monthbar b { font-size: 16px; }
.flip svg { transform: rotate(180deg); }
.icon-btn:disabled { opacity: .35; }
.seg { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 4px; }
.seg button { border: 0; background: none; border-radius: 10px; padding: 10px; font-weight: 800; color: var(--muted); }
.seg button.on { background: #14532d; color: #fff; }
.note { margin: 0 2px; }
.exports { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 8px; }
.ex { display: flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid var(--line); background: #fff; border-radius: 12px;
  padding: 10px 6px; font-weight: 800; font-size: 13px; color: var(--ink); }
.ex.share { background: #25d366; border-color: #25d366; color: #fff; }
.ex:disabled { opacity: .5; }
.ex.month { background: #14532d; border-color: #14532d; color: #fff; }
.viewer { position: fixed; inset: 0; z-index: 50; background: rgba(15,23,42,.6); display: flex; align-items: center; justify-content: center; padding: 12px; }
.vbox { background: #fff; border-radius: 18px; width: 100%; max-width: 760px; max-height: 100%; display: flex; flex-direction: column; gap: 10px; padding: 12px; }
.vhead { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.vimg { overflow: auto; border: 1px solid var(--line); border-radius: 12px; flex: 1; min-height: 0; }
.vimg img { display: block; width: 100%; min-width: 560px; }
.ok { color: var(--g2); font-weight: 700; }
.tablewrap { padding: 0; overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: 12.5px; white-space: nowrap; }
th { background: #15803d; color: #fff; font-weight: 700; padding: 9px 8px; text-align: right; }
td { padding: 9px 8px; text-align: right; border-bottom: 1px solid var(--line); }
.name { text-align: left; position: sticky; left: 0; background: #fff; font-weight: 700; max-width: 120px; overflow: hidden; text-overflow: ellipsis; box-shadow: 1px 0 0 var(--line); }
th.name { background: #15803d; }
tr.me td { background: #fef9c3; } tr.me .name { background: #fef9c3; }
tr.unpaid td { color: var(--muted); }
tfoot td { background: #dcfce7; font-weight: 800; color: #14532d; }
tfoot .name { background: #dcfce7; }
.b { font-weight: 800; } .blue { color: #1d4ed8; } .red { color: var(--red); font-weight: 700; }
.sumrow { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.sumrow div { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 10px 12px; }
.sumrow small { display: block; color: var(--muted); font-weight: 600; } .sumrow b { font-size: 18px; }
</style>
