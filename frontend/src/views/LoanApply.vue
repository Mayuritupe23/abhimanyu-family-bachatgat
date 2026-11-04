<script setup>
// Asking for a loan: amount within the limit, a reason, what it will cost, then it goes to voting.
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { m } from '../api.js';
import { t } from '../i18n.js';
import { rupee } from '../util.js';

const router = useRouter();
const info = ref(null);
const amount = ref(null);
const purpose = ref('');
const busy = ref(false);
const error = ref('');
onMounted(async () => { try { info.value = await m('loans'); } catch (e) { error.value = e.message; } });

const max = computed(() => info.value?.available || 0);
const amt = computed(() => +amount.value || 0);
const tooMuch = computed(() => amt.value > max.value);
const interest = computed(() => Math.round((amt.value * (info.value?.rate || 0)) / 100));
const perMonth = computed(() => Math.ceil(amt.value / (info.value?.tenure || 10) / 100) * 100);
const quick = computed(() => [5000, 10000, 20000].filter((a) => a < max.value).concat(max.value ? [max.value] : []));

async function apply() {
  busy.value = true;
  error.value = '';
  try {
    await m('apply_loan', { amount: amt.value, purpose: purpose.value || undefined });
    router.replace({ name: 'loans', query: { applied: 1 } });
  } catch (e) { error.value = e.message; } finally { busy.value = false; }
}
</script>

<template>
  <div class="stack">
    <div v-if="error" class="error">{{ error }}</div>
    <div v-if="!info && !error" class="skeleton" />

    <template v-if="info">
      <div v-if="info.blocked" class="error">{{ info.blocked }}</div>
      <div v-else-if="!max" class="card empty"><span>🙏</span>{{ t('Your loan limit is used up. Repay some to ask again.') }}</div>

      <template v-else>
        <section class="card">
          <label class="field">{{ t('How much do you need?') }}</label>
          <div class="money" :class="{ bad: tooMuch }"><span>₹</span><input v-model.number="amount" type="number" inputmode="numeric" min="1" :max="max" placeholder="0" /></div>
          <p class="small" :class="tooMuch ? 'red' : 'muted'">{{ t('You can take up to') }} {{ rupee(max) }}</p>
          <div class="quick"><button v-for="a in quick" :key="a" @click="amount = a">{{ rupee(a) }}</button></div>
        </section>

        <section class="card">
          <label class="field">{{ t('What is it for?') }} <span class="muted">({{ t('optional') }})</span>
            <textarea v-model="purpose" class="input area" rows="2" :placeholder="t('e.g. house repair, school fees')" />
          </label>
        </section>

        <section v-if="amt && !tooMuch" class="card cost">
          <b>{{ t('What it will cost') }}</b>
          <div class="line"><span>{{ t('Interest each month') }} ({{ info.rate }}%)</span><b>{{ rupee(interest) }}</b></div>
          <div class="line"><span>{{ t('To close in') }} {{ info.tenure }} {{ t('months, repay about') }}</span><b>{{ rupee(perMonth) }}/{{ t('month') }}</b></div>
          <p class="muted small">{{ t('Interest is only on what is left, so it gets smaller as you repay.') }}</p>
        </section>

        <section class="card how">
          <b>{{ t('What happens next') }}</b>
          <div class="row"><span class="dot">1</span>{{ t('All members see your request and vote') }}</div>
          <div class="row"><span class="dot">2</span>{{ t('The treasurer approves after the votes') }}</div>
          <div class="row"><span class="dot">3</span>{{ t('You get the money; interest starts next month') }}</div>
        </section>

        <button class="btn" :disabled="!amt || tooMuch || busy" @click="apply">{{ busy ? t('Sending…') : `${t('Ask for')} ${rupee(amt)}` }}</button>
      </template>
    </template>
  </div>
</template>

<style scoped>
.money { display: flex; align-items: center; gap: 6px; margin-top: 8px; border: 1.5px solid var(--line); border-radius: 14px; padding: 0 14px; background: #fff; }
.money.bad { border-color: var(--red); }
.money span { font-size: 26px; font-weight: 800; color: var(--muted); }
.money input { flex: 1; min-width: 0; height: 60px; border: 0; outline: none; font-size: 30px; font-weight: 800; background: none; }
.red { color: var(--red); font-weight: 700; }
.quick { display: flex; gap: 6px; flex-wrap: wrap; }
.quick button { border: 1px solid var(--line); background: #fff; border-radius: 99px; padding: 6px 12px; font-size: 13px; font-weight: 700; }
.area { height: auto; padding: 10px 14px; resize: none; }
.cost { background: #fffbeb; border-color: #fde68a; }
.cost p { margin: 6px 0 0; }
.how { display: flex; flex-direction: column; gap: 10px; }
.how .row { font-size: 13.5px; }
.dot { width: 26px; height: 26px; flex: none; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 800; background: #dcfce7; color: #166534; }
</style>
