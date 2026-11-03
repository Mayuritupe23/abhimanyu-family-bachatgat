<script setup>
import { computed, onMounted, ref } from 'vue';
import Icon from '../components/Icon.vue';
import { m } from '../api.js';
import { store } from '../store.js';
import { t } from '../i18n.js';
import { day, monthName, rupee, short } from '../util.js';

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
const toVote = computed(() => d.value?.me?.to_vote?.length || 0);
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

      <!-- approvers: the group's work lives on its own tab, not mixed with their own account -->
      <router-link v-if="d.admin && store.boot?.can_approve" to="/gat" class="tracker">
        <div class="ic"><Icon name="users" /></div>
        <div class="grow">
          <b>{{ t('Gat tracker') }}</b>
          <div class="small">
            <span :class="{ hot: toApprove }">{{ toApprove }} {{ t('to check') }}</span> ·
            {{ d.admin.unpaid.length }} {{ t('not paid') }}
          </div>
        </div>
        →
      </router-link>
      <router-link v-if="toVote" to="/loans" class="nudge blue">
        <Icon name="thumbs" /><span class="grow"><b>{{ toVote }}</b> {{ t('Loan requests') }} · {{ t('Vote') }}</span>→
      </router-link>

      <!-- my khata -->
      <div v-if="d.me" class="two">
        <router-link to="/khata" class="card mini"><span class="muted small">{{ t('My savings') }}</span><b class="g">{{ rupee(d.me.savings) }}</b></router-link>
        <router-link to="/loans" class="card mini"><span class="muted small">{{ t('My loan') }}</span><b class="o">{{ rupee(d.me.loan_total) }}</b></router-link>
      </div>

      <!-- group -->
      <div class="sec"><h2>{{ t('Our Gat') }}</h2></div>
      <div class="card group">
        <div class="ring">
          <svg viewBox="0 0 42 42"><circle cx="21" cy="21" r="17" fill="none" stroke="#e2e8f0" stroke-width="4" />
            <circle cx="21" cy="21" r="17" fill="none" stroke="#16a34a" stroke-width="4" stroke-linecap="round" :stroke-dasharray="`${(pct * 106.8).toFixed(1)} 106.8`" /></svg>
          <div><b>{{ d.group.paid_this_month }}/{{ d.group.members }}</b><span>{{ t('Paid this month') }}</span></div>
        </div>
        <div class="tiles">
          <div><span>🏦</span><small>{{ t('Cash with group') }}</small><b>{{ short(d.group.cash) }}</b></div>
          <div><span>💰</span><small>{{ t('Total savings') }}</small><b>{{ short(d.group.savings) }}</b></div>
          <div><span>🤝</span><small>{{ t('Loans with members') }}</small><b>{{ short(d.group.loans_out) }}</b></div>
          <div><span>📈</span><small>{{ t('Earnings') }}</small><b>{{ short(d.group.earnings) }}</b></div>
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
.tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.tiles div { background: var(--soft); border-radius: 14px; padding: 10px 12px; display: flex; flex-direction: column; }
.tiles span { font-size: 18px; } .tiles small { color: var(--muted); font-weight: 600; margin-top: 2px; } .tiles b { font-size: 18px; font-weight: 800; }
</style>
