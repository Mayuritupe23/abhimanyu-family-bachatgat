<script setup>
import { computed, onMounted, ref } from 'vue';
import Icon from '../components/Icon.vue';
import { m } from '../api.js';
import { store } from '../store.js';
import { t } from '../i18n.js';
import { day, monthName, rupee } from '../util.js';

const d = ref(null);
const error = ref('');
async function load() {
  error.value = '';
  try { d.value = await m('home'); } catch (e) { error.value = e.message; }
}
onMounted(load);

const greeting = computed(() => {
  const h = new Date().getHours();
  return t(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
});
const firstName = computed(() => (d.value?.me?.member_name || store.boot?.full_name || '').split(' ')[0]);
const tm = computed(() => d.value?.me?.this_month);
const late = computed(() => d.value && d.value.days_to_due < 0);
const stamp = computed(() => (tm.value?.status === 'Pending' ? (late.value ? 'Late' : 'Due') : tm.value?.status === 'Paid' ? 'Paid' : 'Sent'));
const pct = computed(() => (d.value?.group.members ? d.value.group.paid_this_month / d.value.group.members : 0));
const toApprove = computed(() => d.value?.admin?.to_verify?.length || 0);
const worth = computed(() => (d.value ? d.value.group.cash + d.value.group.loans_out : 0));
const toVote = computed(() => d.value?.me?.to_vote?.length || 0);
const cards = computed(() => {
  const me = d.value?.me;
  const list = [
    { to: '/pay', icon: 'wallet', g: ['#22c55e', '#15803d'], title: 'Pay Hapta', sub: tm.value?.status === 'Pending' ? rupee(tm.value.amount) : t(tm.value?.status === 'Paid' ? 'Paid' : 'Waiting for approval') },
    { to: '/khata', icon: 'book', g: ['#38bdf8', '#0369a1'], title: 'My Khata', sub: me ? rupee(me.savings) : '' },
    { to: '/loans/apply', icon: 'hand', g: ['#fbbf24', '#d97706'], title: 'Ask for a loan', sub: t('Apply from here') },
    { to: '/loans', icon: 'coins', g: ['#fb923c', '#c2410c'], title: 'My loans', sub: me ? rupee(me.loan_total) : '' },
    { to: '/loans/requests', icon: 'thumbs', g: ['#a78bfa', '#6d28d9'], title: 'Loan requests', sub: toVote.value ? `${toVote.value} ${t('to vote')}` : t('See & vote'), badge: toVote.value },
    { to: '/sheet', icon: 'table', g: ['#34d399', '#047857'], title: 'Monthly sheet', sub: t('Who pays what') },
    { to: '/sheet?tab=statement', icon: 'file', g: ['#2dd4bf', '#0f766e'], title: 'Statement', sub: t('Month-end report') },
    { to: '/expenses', icon: 'receipt', g: ['#f472b6', '#be185d'], title: 'Group expenses', sub: rupee(d.value?.expense_total || 0) },
  ];
  if (store.boot?.can_approve)
    list.push({ to: '/gat', icon: 'users', g: ['#475569', '#0f172a'], title: 'Gat tracker', sub: `${toApprove.value} ${t('to check')}`, badge: toApprove.value });
  return list;
});
</script>

<template>
  <div class="stack">
    <div v-if="error" class="error" @click="load">{{ error }} · {{ t('Retry') }}</div>
    <template v-if="!d && !error"><div class="skeleton" /><div class="skeleton" /></template>

    <template v-if="d">
      <p class="hello">{{ greeting }}, <b>{{ firstName }}</b> 🙏</p>
      <div class="sec"><h2>{{ t('My account') }}</h2></div>

      <!-- this month -->
      <section class="hero">
        <div class="head">
          <span class="lbl">{{ t('This month') }} · {{ monthName(d.month) }}</span>
          <span class="stamp" :class="stamp">{{ t(stamp) }}</span>
        </div>
        <template v-if="tm">
          <div class="amount">{{ rupee(tm.amount) }}</div>
          <div class="parts">
            {{ t('Saving') }} {{ rupee(tm.saving) }}<template v-if="tm.interest"> + {{ t('Interest') }} {{ rupee(tm.interest) }}</template><template v-if="tm.fine"> + {{ t('Fine') }} {{ rupee(tm.fine) }}</template>
          </div>
        </template>
        <div class="due" :class="{ late }">
          <Icon name="calendar" :size="15" />
          <span v-if="d.days_to_due > 0">{{ t('Last date') }} {{ day(d.due_date) }} · {{ d.days_to_due }} {{ t('days left') }}</span>
          <span v-else-if="d.days_to_due === 0">{{ t('Today is the last date') }}</span>
          <span v-else>{{ t('Last date') }} {{ day(d.due_date) }} · {{ t('Fine is running') }}</span>
        </div>
        <router-link v-if="tm?.status === 'Pending'" to="/pay" class="pay">{{ t('Pay now') }} →</router-link>
        <router-link v-else to="/khata" class="pay ghost">{{ tm?.status === 'Paid' ? t('View receipt') : t('Waiting for approval') }}</router-link>
      </section>

      <!-- everything a member can do, one card each -->
      <div class="sec"><h2>{{ t('What would you like to do?') }}</h2></div>
      <div class="grid">
        <router-link v-for="c in cards" :key="c.to" :to="c.to" class="tile" :style="{ '--a': c.g[0], '--b': c.g[1] }">
          <span v-if="c.badge" class="badge">{{ c.badge }}</span>
          <span class="ic"><Icon :name="c.icon" :size="24" /></span>
          <b>{{ t(c.title) }}</b>
          <small>{{ c.sub }}</small>
        </router-link>
      </div>

      <!-- group -->
      <div class="sec"><h2>{{ t('Our Gat') }}</h2></div>
      <div class="card group">
        <div class="ring">
          <svg viewBox="0 0 42 42"><circle cx="21" cy="21" r="17" fill="none" stroke="#e2e8f0" stroke-width="4" />
            <circle cx="21" cy="21" r="17" fill="none" stroke="#16a34a" stroke-width="4" stroke-linecap="round" :stroke-dasharray="`${(pct * 106.8).toFixed(1)} 106.8`" /></svg>
          <div><b>{{ d.group.paid_this_month }}/{{ d.group.members }}</b><span>{{ t('Paid this month') }}</span></div>
        </div>
        <!-- the group's whole money: what is with the group plus what members hold as loans -->
        <div class="worth">
          <span>{{ t('Total money of the Gat') }}</span>
          <b>{{ rupee(worth) }}</b>
          <div class="split">
            <span :style="{ width: `${worth ? (d.group.cash / worth) * 100 : 0}%` }" class="cash" />
            <span :style="{ width: `${worth ? (d.group.loans_out / worth) * 100 : 0}%` }" class="loan" />
          </div>
          <div class="legend">
            <span><i class="cash" />{{ t('With the group') }} <b>{{ rupee(d.group.cash) }}</b></span>
            <span><i class="loan" />{{ t('With members as loans') }} <b>{{ rupee(d.group.loans_out) }}</b></span>
          </div>
          <p class="came">{{ t('Where it came from') }}: {{ t('Savings') }} {{ rupee(d.group.savings) }} + {{ t('Earnings') }} {{ rupee(d.group.earnings) }}</p>
        </div>
        <div class="tiles">
          <div style="--a:#22c55e;--b:#15803d"><i><Icon name="bank" :size="18" /></i><small>{{ t('Money with group') }}</small><b>{{ rupee(d.group.cash) }}</b></div>
          <div style="--a:#fb923c;--b:#c2410c"><i><Icon name="hand" :size="18" /></i><small>{{ t('Loans with members') }}</small><b>{{ rupee(d.group.loans_out) }}</b></div>
          <div style="--a:#38bdf8;--b:#0369a1"><i><Icon name="piggy" :size="18" /></i><small>{{ t('Total savings') }}</small><b>{{ rupee(d.group.savings) }}</b></div>
          <div style="--a:#fbbf24;--b:#b45309"><i><Icon name="trend" :size="18" /></i><small>{{ t('Earnings') }}</small><b>{{ rupee(d.group.earnings) }}</b></div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.hello { margin: 2px 2px 0; font-size: 15px; color: var(--muted); }
.hello b { color: var(--ink); }
.hero { position: relative; overflow: hidden; border-radius: 22px; padding: 18px; color: #fff;
  background: radial-gradient(circle at 95% 0, rgba(245,158,11,.5), transparent 42%), linear-gradient(135deg, #16a34a, #14532d); box-shadow: 0 14px 30px rgba(20,83,45,.28); }
.head { display: flex; justify-content: space-between; align-items: center; }
.lbl { font-size: 12px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; opacity: .9; }
.stamp { font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; padding: 3px 9px; border-radius: 8px; border: 2px solid; transform: rotate(-6deg); }
.stamp.Paid { color: #bbf7d0; } .stamp.Due { color: #fde68a; } .stamp.Late { color: #fecaca; } .stamp.Sent { color: #bae6fd; }
.amount { font-size: 38px; font-weight: 800; letter-spacing: -1px; margin-top: 8px; }
.parts { font-size: 13px; opacity: .9; }
.due { margin-top: 12px; display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 10px; background: rgba(255,255,255,.16); font-size: 12.5px; font-weight: 600; }
.due.late { background: #fee2e2; color: #991b1b; }
.pay { display: block; margin-top: 14px; text-align: center; padding: 13px; border-radius: 14px; font-weight: 800; background: #fbbf24; color: #451a03; }
.pay.ghost { background: rgba(255,255,255,.18); color: #fff; }
.nudge { display: flex; align-items: center; gap: 10px; padding: 13px 14px; border-radius: 16px; font-size: 14px; font-weight: 600; }
.nudge.orange { background: #fff7ed; color: #9a3412; border: 1px solid #fed7aa; }
.nudge.blue { background: #f0f9ff; color: #075985; border: 1px solid #bae6fd; }
.grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.tile { position: relative; overflow: hidden; background: #fff; border-radius: 20px; padding: 14px 8px 12px; display: flex; flex-direction: column;
  align-items: center; text-align: center; gap: 3px; box-shadow: 0 1px 2px rgba(15,23,42,.04), 0 6px 16px rgba(15,23,42,.05); border: 1px solid #eef2f0;
  transition: transform .12s ease; }
.tile::before { content: ''; position: absolute; inset: auto -30% 62% -30%; height: 80px; background: radial-gradient(closest-side, color-mix(in srgb, var(--a) 22%, transparent), transparent); }
.tile:active { transform: scale(.96); }
.tile .ic { position: relative; width: 50px; height: 50px; border-radius: 16px; display: grid; place-items: center; margin-bottom: 7px; color: #fff;
  background: linear-gradient(140deg, var(--a), var(--b)); box-shadow: 0 8px 16px color-mix(in srgb, var(--b) 35%, transparent), inset 0 1px 0 rgba(255,255,255,.35); }
.tile b { position: relative; font-size: 12.5px; line-height: 1.2; }
.tile small { position: relative; color: var(--muted); font-size: 11px; font-weight: 600; line-height: 1.25; }
.badge { position: absolute; z-index: 1; top: 8px; right: 8px; box-shadow: 0 0 0 2px #fff; min-width: 22px; height: 22px; padding: 0 6px; border-radius: 99px; display: grid; place-items: center; background: var(--red); color: #fff; font-size: 12px; font-weight: 800; }
.tracker { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 18px; background: #0f172a; color: #fff; font-weight: 600; }
.tracker .ic { width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; background: rgba(255,255,255,.12); }
.tracker b { font-size: 15px; }
.tracker .small { opacity: .8; margin-top: 2px; }
.tracker .hot { color: #fbbf24; font-weight: 800; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.mini { display: flex; flex-direction: column; gap: 4px; }
.mini b { font-size: 21px; font-weight: 800; } .g { color: var(--g2); } .o { color: #c2410c; }
.group { display: flex; flex-direction: column; gap: 14px; }
.ring { display: flex; align-items: center; gap: 14px; }
.ring svg { width: 64px; height: 64px; transform: rotate(-90deg); }
.ring b { display: block; font-size: 20px; } .ring span { font-size: 12px; color: var(--muted); }
.worth { border-radius: 18px; padding: 16px; color: #fff; background: radial-gradient(circle at 95% 0, rgba(245,158,11,.45), transparent 45%), linear-gradient(135deg, #16a34a, #14532d); }
.worth > span { font-size: 12.5px; font-weight: 700; opacity: .9; }
.worth > b { display: block; font-size: 30px; font-weight: 800; letter-spacing: -.5px; margin: 2px 0 10px; }
.split { display: flex; height: 10px; border-radius: 99px; overflow: hidden; background: rgba(255,255,255,.2); }
.split .cash { background: #86efac; } .split .loan { background: #fbbf24; }
.legend { display: flex; flex-direction: column; gap: 4px; margin-top: 10px; font-size: 12.5px; }
.legend span { display: flex; align-items: center; gap: 6px; } .legend b { margin-left: auto; }
.legend i { width: 10px; height: 10px; border-radius: 3px; } .legend i.cash { background: #86efac; } .legend i.loan { background: #fbbf24; }
.came { margin: 10px 0 0; font-size: 11.5px; opacity: .85; border-top: 1px solid rgba(255,255,255,.2); padding-top: 8px; }
.tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.tiles div { background: color-mix(in srgb, var(--a) 9%, white); border-radius: 16px; padding: 12px; display: flex; flex-direction: column; }
.tiles i { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; color: #fff; margin-bottom: 4px;
  background: linear-gradient(140deg, var(--a), var(--b)); box-shadow: 0 4px 10px color-mix(in srgb, var(--b) 30%, transparent); } .tiles small { color: var(--muted); font-weight: 600; margin-top: 2px; } .tiles b { font-size: 17px; font-weight: 800; }
</style>
