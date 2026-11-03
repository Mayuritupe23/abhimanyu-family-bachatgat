<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import Icon from '../components/Icon.vue';
import { m, shrink, upload } from '../api.js';
import { store } from '../store.js';
import { t } from '../i18n.js';
import { monthName, rupee, todayISO } from '../util.js';

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

let timer;
async function refresh() {
  error.value = '';
  try {
    p.value = await m('pay_preview', { month: `${month.value}-01`, payment_date: todayISO(), principals: { ...principal } });
    p.value.loans.forEach((l) => { if (!(l.loan in principal)) principal[l.loan] = 0; });
  } catch (e) { error.value = e.message; }
}
onMounted(refresh);
watch(month, () => { Object.keys(principal).forEach((k) => delete principal[k]); refresh(); });
watch(principal, () => { clearTimeout(timer); timer = setTimeout(refresh, 350); }, { deep: true });

const closesAll = computed(() => p.value?.loans.length && p.value.loans.every((l) => +principal[l.loan] >= l.outstanding));
function closeAll() { p.value.loans.forEach((l) => { principal[l.loan] = l.outstanding; }); }
const upiLink = computed(() => pay.upi && p.value
  ? `upi://pay?pa=${encodeURIComponent(pay.upi)}&pn=${encodeURIComponent(pay.payee || '')}&am=${p.value.total}&cu=INR&tn=${encodeURIComponent('AFBG ' + month.value)}`
  : '');

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
      month: `${month.value}-01`, payment_date: todayISO(), screenshot: file_url, principals: { ...principal }, utr: utr.value || undefined,
    });
  } catch (e) { error.value = e.message; } finally { busy.value = false; }
}
</script>

<template>
  <div v-if="done" class="stack ok">
    <div class="tick">✓</div>
    <h2>{{ t('Payment sent') }}</h2>
    <p class="muted">{{ rupee(done.total) }} · {{ monthName(`${month}-01`) }}</p>
    <p class="muted">{{ t('Approvers will check it and approve.') }}</p>
    <router-link to="/" class="btn">{{ t('Done') }}</router-link>
  </div>

  <div v-else class="stack">
    <label class="field">{{ t('Month') }}
      <input v-model="month" class="input" type="month" :max="todayISO().slice(0, 7)" />
    </label>

    <div v-if="error" class="error">{{ error }}</div>

    <section v-if="p" class="card bill">
      <div class="line"><span>{{ t('Saving') }}</span><b>{{ rupee(p.saving) }}</b></div>
      <div v-if="p.interest" class="line"><span>{{ t('Interest') }}</span><b>{{ rupee(p.interest) }}</b></div>
      <div v-if="p.principal" class="line"><span>{{ t('EMI') }}</span><b>{{ rupee(p.principal) }}</b></div>
      <div v-if="p.fine" class="line fine"><span>{{ t('Fine') }} ({{ p.days_late }} d)</span><b>{{ rupee(p.fine) }}</b></div>
      <div class="divider" />
      <div class="line total"><span>{{ t('Total') }}</span><b>{{ rupee(p.total) }}</b></div>
    </section>

    <section v-if="p?.loans.length" class="card">
      <b>{{ t('Pay back more of your loan?') }}</b>
      <div v-for="l in p.loans" :key="l.loan" class="loan">
        <span class="muted small">{{ l.loan }} · {{ t('Left') }} {{ rupee(l.outstanding) }}</span>
        <input v-model.number="principal[l.loan]" class="input" type="number" inputmode="numeric" min="0" :max="l.outstanding" :placeholder="t('EMI')" />
      </div>
      <button v-if="!closesAll" class="btn ghost small" @click="closeAll">{{ t('Close the loan') }}</button>
    </section>

    <section v-if="pay.qr || pay.upi" class="card qr">
      <span class="muted small">{{ t('Scan and pay to') }}</span>
      <b class="payee">{{ pay.payee }}</b>
      <img v-if="pay.qr" :src="pay.qr" alt="QR" />
      <span v-if="pay.upi" class="muted small">{{ pay.upi }}</span>
      <a v-if="upiLink" :href="upiLink" class="btn">{{ t('Pay in UPI app') }} · {{ rupee(p?.total) }}</a>
    </section>

    <section class="card">
      <b>{{ t('Payment screenshot') }}</b>
      <label class="shot">
        <img v-if="shotUrl" :src="shotUrl" alt="" />
        <span v-else><Icon name="camera" :size="28" />{{ t('Add screenshot') }}</span>
        <input type="file" accept="image/*" @change="pick" hidden />
      </label>
      <input v-model="utr" class="input" placeholder="UPI / UTR No (optional)" />
    </section>

    <button class="btn" :disabled="!p || !shot || busy" @click="submit">{{ busy ? t('Sending…') : `${t('Send for approval')} · ${rupee(p?.total)}` }}</button>
  </div>
</template>

<style scoped>
.bill .total b { font-size: 24px; font-weight: 800; color: var(--ink); }
.bill .total span { color: var(--ink); font-weight: 700; align-self: center; }
.fine b { color: var(--red) !important; }
.loan { display: flex; flex-direction: column; gap: 6px; margin: 10px 0; }
.qr { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center;
  background: linear-gradient(135deg, #f0fdf4, #fffbeb); }
.qr img { width: 230px; max-width: 100%; border-radius: 14px; background: #fff; padding: 8px; box-shadow: 0 6px 18px rgba(0,0,0,.08); }
.payee { font-size: 18px; color: var(--g3); }
.shot { margin: 10px 0; display: grid; place-items: center; min-height: 130px; border: 2px dashed var(--line); border-radius: 14px; color: var(--muted); cursor: pointer; overflow: hidden; }
.shot span { display: flex; flex-direction: column; align-items: center; gap: 6px; font-weight: 700; }
.shot img { width: 100%; max-height: 320px; object-fit: contain; }
.ok { align-items: center; text-align: center; padding-top: 40px; }
.tick { width: 84px; height: 84px; border-radius: 50%; display: grid; place-items: center; font-size: 42px; color: #fff; background: linear-gradient(135deg, #16a34a, #14532d); box-shadow: 0 12px 26px rgba(22,163,74,.35); }
.ok h2 { margin: 6px 0 0; }
.ok p { margin: 0; }
</style>
