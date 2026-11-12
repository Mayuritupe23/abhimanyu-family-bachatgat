<script setup>
// Every rupee the group spent, for everyone to see. Approvers can add one.
import { onMounted, ref } from 'vue';
import { m, shrink, upload } from '../api.js';
import { t } from '../i18n.js';
import { day, rupee, todayISO } from '../util.js';

const d = ref(null);
const error = ref('');
const adding = ref(false);
const form = ref({ date: todayISO(), amount: null, description: '' });
const busy = ref(false);
const bill = ref(null); // photo of the bill / payment screenshot, optional
const billUrl = ref('');
function pickBill(e) {
  bill.value = e.target.files[0] || null;
  if (billUrl.value) URL.revokeObjectURL(billUrl.value);
  billUrl.value = bill.value ? URL.createObjectURL(bill.value) : '';
}
onMounted(async () => { try { d.value = await m('expenses'); } catch (e) { error.value = e.message; } });

async function save() {
  busy.value = true;
  error.value = '';
  try {
    const receipt = bill.value ? await upload(await shrink(bill.value)) : undefined;
    d.value = await m('add_expense', { ...form.value, receipt });
    adding.value = false;
    form.value = { date: todayISO(), amount: null, description: '' };
    pickBill({ target: { files: [] } });
  } catch (e) { error.value = e.message; } finally { busy.value = false; }
}
</script>

<template>
  <div class="stack">
    <div v-if="error" class="error">{{ error }}</div>
    <div v-if="!d && !error" class="skeleton" />
    <template v-if="d">
      <section class="sum">
        <span>{{ t('Total spent by the group') }}</span>
        <b>{{ rupee(d.total) }}</b>
        <small>{{ t('This comes out of the group\'s earnings') }}</small>
      </section>

      <button v-if="d.can_add && !adding" class="btn ghost" @click="adding = true">+ {{ t('Add expense') }}</button>
      <section v-if="adding" class="card stack">
        <label class="field">{{ t('What was it for?') }}<input v-model="form.description" class="input" :placeholder="t('e.g. meeting tea, bank charges')" /></label>
        <label class="field">{{ t('Amount') }}<input v-model.number="form.amount" class="input" type="number" inputmode="numeric" min="1" /></label>
        <label class="field">{{ t('Date') }}<input v-model="form.date" class="input" type="date" :max="todayISO()" /></label>
        <label class="shot">
          <input type="file" accept="image/*" hidden @change="pickBill" />
          <img v-if="billUrl" :src="billUrl" alt="" />
          <span v-else>📷 {{ t('Add bill photo / screenshot (optional)') }}</span>
        </label>
        <div class="two"><button class="btn ghost" @click="adding = false">{{ t('Cancel') }}</button>
          <button class="btn" :disabled="busy || !form.amount || !form.description" @click="save">{{ t('Save') }}</button></div>
      </section>

      <div v-if="!d.rows.length" class="card empty"><span>🧾</span>{{ t('No expenses yet') }}</div>
      <article v-for="e in d.rows" :key="e.name" class="card row item">
        <div class="ic">🧾</div>
        <div class="grow"><b>{{ e.description }}</b><div class="muted small">{{ day(e.date) }}</div></div>
        <a v-if="e.receipt" class="billbtn" :href="e.receipt" target="_blank" rel="noopener">📎 {{ t('Bill') }}</a>
        <b class="amt">{{ rupee(e.amount) }}</b>
      </article>
    </template>
  </div>
</template>

<style scoped>
.sum { border-radius: 20px; padding: 18px; color: #fff; display: flex; flex-direction: column; gap: 2px; background: linear-gradient(135deg, #475569, #1e293b); }
.sum span { font-size: 12.5px; opacity: .9; font-weight: 600; } .sum b { font-size: 32px; font-weight: 800; } .sum small { opacity: .8; }
.item { padding: 12px 14px; }
.ic { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; background: var(--soft); font-size: 18px; flex: none; }
.amt { font-size: 16px; }
.shot { display: grid; place-items: center; min-height: 90px; border: 2px dashed var(--line); border-radius: 14px; color: var(--muted); font-weight: 700; cursor: pointer; overflow: hidden; }
.shot img { width: 100%; max-height: 220px; object-fit: contain; }
.billbtn { flex: none; font-size: 12px; font-weight: 800; padding: 6px 10px; border-radius: 99px; background: #dcfce7; color: #166534; text-decoration: none; }
.two { display: grid; grid-template-columns: 1fr 1.4fr; gap: 10px; }
</style>
