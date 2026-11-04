<script setup>
// Paying the hapta in three plain steps: 1 how much, 2 pay by UPI, 3 send the screenshot.
import { computed, onMounted, reactive, ref, watch } from 'vue';
import Icon from '../components/Icon.vue';
import { m, shrink, upload } from '../api.js';
import { store } from '../store.js';
import { t } from '../i18n.js';
import { day, monthName, rupee, todayISO } from '../util.js';

const step = ref(1);
const month = ref(todayISO().slice(0, 7));
const p = ref(null);
const principal = reactive({});
const error = ref('');
const shot = ref(null);
const shotUrl = ref('');
const utr = ref('');
const busy = ref(false);
const done = ref(null);
const pay = store.boot?.pay || {};
const monthDate = computed(() => `${month.value}-01`);

let timer;
async function refresh() {
  error.value = '';
  try {
    p.value = await m('pay_preview', { month: monthDate.value, payment_date: todayISO(), principals: { ...principal } });
    (p.value.loans || []).forEach((l) => { if (!(l.loan in principal)) principal[l.loan] = 0; });
  } catch (e) { error.value = e.message; }
}
onMounted(refresh);
watch(month, () => { Object.keys(principal).forEach((k) => delete principal[k]); step.value = 1; refresh(); });
watch(principal, () => { clearTimeout(timer); timer = setTimeout(refresh, 350); }, { deep: true });

const loans = computed(() => p.value?.loans || []);
const closesAll = computed(() => loans.value.length && loans.value.every((l) => +principal[l.loan] >= l.outstanding));
function closeAll() { loans.value.forEach((l) => { principal[l.loan] = l.outstanding; }); }
function clearEmi() { loans.value.forEach((l) => { principal[l.loan] = 0; }); }
const upiLink = computed(() => (pay.upi && p.value?.total
  ? `upi://pay?pa=${encodeURIComponent(pay.upi)}&pn=${encodeURIComponent(pay.payee || '')}&am=${p.value.total}&cu=INR&tn=${encodeURIComponent('AFBG ' + month.value)}`
  : ''));

function pick(e) {
  const f = e.target.files[0];
  if (!f) return;
  shot.value = f;
  shotUrl.value = URL.createObjectURL(f);
}

async function submit() {
  busy.value = true;
  error.value = '';
  try {
    const file_url = await upload(await shrink(shot.value));
    done.value = await m('submit_payment', {
      month: monthDate.value, payment_date: todayISO(), screenshot: file_url, principals: { ...principal }, utr: utr.value || undefined,
    });
  } catch (e) { error.value = e.message; } finally { busy.value = false; }
}
const steps = ['Amount', 'Pay', 'Proof'];
</script>

<template>
  <!-- sent -->
  <div v-if="done" class="stack ok">
    <div class="tick">✓</div>
    <h2>{{ t('Payment sent') }}</h2>
    <p class="muted">{{ rupee(done.total) }} · {{ monthName(monthDate) }}</p>
    <div class="card next">
      <div class="row"><span class="dot on">1</span><span>{{ t('You sent the payment') }}</span></div>
      <div class="row"><span class="dot">2</span><span>{{ t('Approvers check it with the bank') }}</span></div>
      <div class="row"><span class="dot">3</span><span>{{ t('It shows as Paid in your Khata') }}</span></div>
    </div>
    <router-link to="/" class="btn">{{ t('Done') }}</router-link>
  </div>

  <div v-else class="stack">
    <label class="field">{{ t('Paying for') }}
      <input v-model="month" class="input" type="month" :max="todayISO().slice(0, 7)" />
    </label>

    <div v-if="error" class="error">{{ error }}</div>
    <div v-if="!p && !error" class="skeleton" />

    <!-- this month is already sent or paid -->
    <section v-if="p?.existing" class="card already">
      <span class="pill" :class="p.existing.docstatus === 1 ? 'green' : 'blue'">{{ p.existing.docstatus === 1 ? t('Paid') : t('Waiting for approval') }}</span>
      <h3>{{ rupee(p.existing.total) }}</h3>
      <p class="muted">{{ monthName(monthDate) }} · {{ t('Paid on') }} {{ day(p.existing.payment_date) }}</p>
      <p class="muted small">{{ t('Already sent for this month') }}. {{ t('Pick another month above if you are paying an old one.') }}</p>
      <router-link to="/khata" class="btn ghost">{{ t('My Khata') }}</router-link>
    </section>

    <template v-if="p && !p.existing">
      <ol class="steps">
        <li v-for="(s, i) in steps" :key="s" :class="{ on: step === i + 1, done: step > i + 1 }">
          <span>{{ step > i + 1 ? '✓' : i + 1 }}</span>{{ t(s) }}
        </li>
      </ol>

      <!-- 1: how much -->
      <template v-if="step === 1">
        <section class="card bill">
          <div class="line"><span>{{ t('Saving') }}</span><b>{{ rupee(p.saving) }}</b></div>
          <div v-if="p.interest" class="line"><span>{{ t('Loan interest') }}</span><b>{{ rupee(p.interest) }}</b></div>
          <div v-if="p.principal" class="line"><span>{{ t('Loan repayment (EMI)') }}</span><b>{{ rupee(p.principal) }}</b></div>
          <div v-if="p.fine" class="line fine"><span>{{ t('Late fine') }} · {{ p.days_late }} {{ t('days') }}</span><b>{{ rupee(p.fine) }}</b></div>
          <div class="divider" />
          <div class="line total"><span>{{ t('To pay') }}</span><b>{{ rupee(p.total) }}</b></div>
        </section>

        <section v-if="loans.length" class="card emi">
          <b>{{ t('Want to repay some loan too?') }}</b>
          <p class="muted small">{{ t('Optional. Whatever you repay lowers next month\'s interest.') }}</p>
          <div v-for="l in loans" :key="l.loan" class="loan">
            <div class="row small"><span class="grow muted">{{ t('Loan left') }}</span><b>{{ rupee(l.outstanding) }}</b></div>
            <div class="money"><span>₹</span><input v-model.number="principal[l.loan]" type="number" inputmode="numeric" min="0" :max="l.outstanding" placeholder="0" /></div>
            <div class="quick">
              <button v-for="a in [1000, 2000, 5000].filter((x) => x < l.outstanding)" :key="a" @click="principal[l.loan] = a">{{ rupee(a) }}</button>
              <button @click="principal[l.loan] = l.outstanding">{{ t('Full') }}</button>
            </div>
          </div>
          <button v-if="!closesAll" class="btn ghost small" @click="closeAll">{{ t('Close the loan') }}</button>
          <button v-else class="btn ghost small" @click="clearEmi">{{ t('Not now') }}</button>
        </section>

        <button class="btn" @click="step = 2">{{ t('Next') }}: {{ t('Pay') }} {{ rupee(p.total) }} →</button>
      </template>

      <!-- 2: pay -->
      <template v-if="step === 2">
        <section class="card qr">
          <span class="muted small">{{ t('Scan and pay to') }}</span>
          <b class="payee">{{ pay.payee || '—' }}</b>
          <div class="amt">{{ rupee(p.total) }}</div>
          <img v-if="pay.qr" :src="pay.qr" alt="QR" />
          <span v-if="pay.upi" class="muted small">{{ pay.upi }}</span>
          <a v-if="upiLink" :href="upiLink" class="btn">{{ t('Pay in UPI app') }}</a>
          <p v-if="!pay.qr && !pay.upi" class="muted small">{{ t('Ask the treasurer where to pay.') }}</p>
        </section>
        <p class="hint">{{ t('Pay exactly this amount, then take a screenshot of the success screen.') }}</p>
        <div class="two-btn">
          <button class="btn ghost" @click="step = 1">← {{ t('Back') }}</button>
          <button class="btn" @click="step = 3">{{ t('I have paid') }} →</button>
        </div>
      </template>

      <!-- 3: proof -->
      <template v-if="step === 3">
        <section class="card">
          <b>{{ t('Payment screenshot') }}</b>
          <label class="shot" :class="{ has: shotUrl }">
            <img v-if="shotUrl" :src="shotUrl" alt="" />
            <span v-else><Icon name="camera" :size="30" />{{ t('Tap to add the screenshot') }}</span>
            <input type="file" accept="image/*" hidden @change="pick" />
          </label>
          <label class="field">{{ t('UPI / UTR No (optional)') }}<input v-model="utr" class="input" inputmode="numeric" /></label>
        </section>
        <div class="two-btn">
          <button class="btn ghost" @click="step = 2">← {{ t('Back') }}</button>
          <button class="btn" :disabled="!shot || busy" @click="submit">{{ busy ? t('Sending…') : t('Send for approval') }}</button>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.steps { list-style: none; margin: 0; padding: 0; display: flex; gap: 6px; }
.steps li { flex: 1; display: flex; align-items: center; gap: 6px; padding: 8px; border-radius: 12px; background: #fff; border: 1px solid var(--line);
  font-size: 12.5px; font-weight: 700; color: var(--muted); }
.steps li span { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; background: var(--soft); font-size: 12px; }
.steps li.on { border-color: var(--g1); color: var(--g3); }
.steps li.on span { background: var(--g1); color: #fff; }
.steps li.done span { background: #dcfce7; color: #166534; }
.bill .total span { color: var(--ink); font-weight: 800; align-self: center; }
.bill .total b { font-size: 26px; font-weight: 800; }
.fine b { color: var(--red) !important; }
.emi p { margin: 4px 0 8px; }
.loan { margin: 10px 0; padding: 12px; border-radius: 14px; background: var(--soft); display: flex; flex-direction: column; gap: 8px; }
.money { display: flex; align-items: center; gap: 6px; background: #fff; border: 1.5px solid var(--line); border-radius: 12px; padding: 0 12px; }
.money span { font-size: 20px; font-weight: 800; color: var(--muted); }
.money input { flex: 1; min-width: 0; border: 0; outline: none; height: 48px; font-size: 22px; font-weight: 800; background: none; }
.quick { display: flex; gap: 6px; flex-wrap: wrap; }
.quick button { border: 1px solid var(--line); background: #fff; border-radius: 99px; padding: 5px 11px; font-size: 12.5px; font-weight: 700; }
.qr { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; background: linear-gradient(135deg, #f0fdf4, #fffbeb); }
.qr img { width: 240px; max-width: 100%; border-radius: 14px; background: #fff; padding: 8px; box-shadow: 0 6px 18px rgba(0,0,0,.08); }
.payee { font-size: 18px; color: var(--g3); }
.amt { font-size: 32px; font-weight: 800; }
.hint { margin: 0 4px; font-size: 13px; color: var(--muted); text-align: center; }
.two-btn { display: grid; grid-template-columns: 1fr 1.6fr; gap: 10px; }
.shot { margin: 10px 0 14px; display: grid; place-items: center; min-height: 170px; border: 2px dashed #86efac; border-radius: 16px; background: #f0fdf4; color: var(--g2); cursor: pointer; overflow: hidden; }
.shot.has { border-style: solid; border-color: var(--line); background: #fff; }
.shot span { display: flex; flex-direction: column; align-items: center; gap: 8px; font-weight: 700; }
.shot img { width: 100%; max-height: 340px; object-fit: contain; }
.already { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.already h3 { margin: 6px 0 0; font-size: 30px; }
.already p { margin: 0; }
.already .btn { margin-top: 10px; }
.ok { align-items: center; text-align: center; padding-top: 30px; }
.tick { width: 84px; height: 84px; border-radius: 50%; display: grid; place-items: center; font-size: 42px; color: #fff; background: linear-gradient(135deg, #16a34a, #14532d); box-shadow: 0 12px 26px rgba(22,163,74,.35); }
.ok h2 { margin: 6px 0 0; } .ok > p { margin: 0; }
.next { width: 100%; text-align: left; display: flex; flex-direction: column; gap: 10px; }
.dot { width: 26px; height: 26px; flex: none; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 800; background: var(--soft); color: var(--muted); }
.dot.on { background: var(--g1); color: #fff; }
</style>
