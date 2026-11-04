<script setup>
// The group's account in plain steps, the way it is explained in a meeting:
// 1 what we earned (interest + fines - expenses), 2 the group's total money, 3 where that money is now.
import { onMounted, ref } from 'vue';
import { m } from '../api.js';
import { t } from '../i18n.js';
import { day, monthName, rupee } from '../util.js';

const h = ref(null);
const error = ref('');
const showMonths = ref(false);
onMounted(async () => { try { h.value = await m('hisaab'); } catch (e) { error.value = e.message; } });
</script>

<template>
  <div class="stack">
    <div v-if="error" class="error">{{ error }}</div>
    <div v-if="!h && !error" class="skeleton" />
    <template v-if="h">
      <!-- 1. earnings -->
      <section class="card step">
        <div class="num">1</div>
        <h3>{{ t('What the Gat earned') }}</h3>
        <div class="line"><span>{{ t('Interest from loans') }}</span><b class="plus">+ {{ rupee(h.interest) }}</b></div>
        <div class="line"><span>{{ t('Late fines') }}</span><b class="plus">+ {{ rupee(h.fines) }}</b></div>
        <div v-if="h.opening_earnings" class="line"><span>{{ t('Earned before the app') }}</span><b class="plus">+ {{ rupee(h.opening_earnings) }}</b></div>
        <router-link to="/expenses" class="line link"><span>{{ t('Minus group expenses') }} →</span><b class="minus">− {{ rupee(h.expense) }}</b></router-link>
        <div class="divider" />
        <div class="line total"><span>{{ t('Earnings after expenses') }}</span><b>{{ rupee(h.earnings) }}</b></div>
        <p class="note">{{ t('Expenses are taken out of the earnings, never out of anyone\'s savings.') }}</p>
      </section>

      <!-- 2. total money -->
      <section class="card step">
        <div class="num">2</div>
        <h3>{{ t('Total money of the Gat') }}</h3>
        <div class="line"><span>{{ t('Members\' savings') }}</span><b>{{ rupee(h.savings) }}</b></div>
        <div class="line"><span>{{ t('Earnings after expenses') }}</span><b class="plus">+ {{ rupee(h.earnings) }}</b></div>
        <div v-if="h.exits" class="line"><span>{{ t('Paid to members who left') }}</span><b class="minus">− {{ rupee(h.exits) }}</b></div>
        <div class="divider" />
        <div class="line total big"><span>{{ t('Total') }}</span><b>{{ rupee(h.worth) }}</b></div>
      </section>

      <!-- 3. where it is -->
      <section class="card step">
        <div class="num">3</div>
        <h3>{{ t('Where this money is now') }}</h3>
        <div class="split">
          <span class="cash" :style="{ width: `${(h.cash / h.worth) * 100}%` }" />
          <span class="loan" :style="{ width: `${(h.loans_out / h.worth) * 100}%` }" />
        </div>
        <div class="line"><span><i class="dot cash" />{{ t('With the group (bank / UPI)') }}</span><b>{{ rupee(h.cash) }}</b></div>
        <router-link to="/sheet?tab=statement" class="line link"><span><i class="dot loan" />{{ t('With members as loans') }} →</span><b>{{ rupee(h.loans_out) }}</b></router-link>
        <div class="divider" />
        <div class="line total"><span>{{ t('Total') }}</span><b>{{ rupee(h.cash + h.loans_out) }}</b></div>
        <div class="ok" :class="{ bad: Math.round(h.cash + h.loans_out) !== Math.round(h.worth) }">
          {{ Math.round(h.cash + h.loans_out) === Math.round(h.worth) ? '✓ ' + t('Both totals match. The account is correct.') : '⚠ ' + t('Totals do not match. Please tell the treasurer.') }}
        </div>
      </section>

      <!-- loans so far -->
      <section class="card">
        <h3>{{ t('Loans so far') }}</h3>
        <div class="line"><span>{{ t('Loans given') }}</span><b>{{ rupee(h.given) }}</b></div>
        <div class="line"><span>{{ t('Repaid by members') }}</span><b class="plus">− {{ rupee(h.repaid) }}</b></div>
        <div class="divider" />
        <div class="line total"><span>{{ t('Still with members') }}</span><b>{{ rupee(h.loans_out) }}</b></div>
      </section>

      <!-- month by month -->
      <section class="card">
        <button class="toggle" @click="showMonths = !showMonths"><h3>{{ t('Month by month') }}</h3><span>{{ showMonths ? '▲' : '▼' }}</span></button>
        <table v-if="showMonths">
          <thead><tr><th>{{ t('Month') }}</th><th>{{ t('Savings') }}</th><th>{{ t('Interest') }}</th><th>{{ t('Fine') }}</th></tr></thead>
          <tbody><tr v-for="r in h.months" :key="r.month"><td>{{ monthName(r.month) }}</td><td>{{ rupee(r.saving) }}</td><td>{{ rupee(r.interest) }}</td><td>{{ rupee(r.fine) }}</td></tr></tbody>
        </table>
      </section>

      <p class="muted small foot">{{ t('Updated') }} {{ day(new Date().toISOString().slice(0, 10)) }} · {{ t('only approved payments are counted') }}</p>
    </template>
  </div>
</template>

<style scoped>
h3 { margin: 0 0 8px; font-size: 15px; font-weight: 800; }
.step { position: relative; padding-top: 18px; }
.num { position: absolute; top: 14px; right: 14px; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
  font-weight: 800; font-size: 13px; color: #fff; background: linear-gradient(140deg, #22c55e, #15803d); }
.line span { display: flex; align-items: center; gap: 7px; }
.link { color: inherit; }
.link span { color: var(--g2); font-weight: 700; }
.plus { color: var(--g2) !important; } .minus { color: var(--red) !important; }
.total span { color: var(--ink); font-weight: 800; }
.total b { font-size: 18px; font-weight: 800; }
.total.big b { font-size: 24px; }
.note { margin: 8px 0 0; font-size: 12px; color: var(--muted); background: #fffbeb; border-radius: 10px; padding: 8px 10px; }
.split { display: flex; height: 12px; border-radius: 99px; overflow: hidden; background: var(--soft); margin-bottom: 8px; }
.split .cash { background: #22c55e; } .split .loan { background: #f59e0b; }
.dot { display: inline-block; width: 10px; height: 10px; border-radius: 3px; }
.dot.cash { background: #22c55e; } .dot.loan { background: #f59e0b; }
.ok { margin-top: 10px; padding: 10px 12px; border-radius: 12px; background: #dcfce7; color: #166534; font-weight: 700; font-size: 13px; }
.ok.bad { background: #fee2e2; color: #991b1b; }
.toggle { width: 100%; display: flex; justify-content: space-between; align-items: center; border: 0; background: none; padding: 0; color: var(--ink); }
.toggle h3 { margin: 0; }
table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12.5px; }
th { text-align: right; color: var(--muted); font-weight: 700; padding: 6px 4px; border-bottom: 1px solid var(--line); }
td { text-align: right; padding: 7px 4px; border-bottom: 1px solid var(--line); }
th:first-child, td:first-child { text-align: left; }
.foot { text-align: center; }
</style>
