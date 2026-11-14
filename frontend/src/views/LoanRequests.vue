<script setup>
// Other members' loan requests: see who asked, how much and why, and vote.
import { computed, onMounted, ref } from 'vue';
import Avatar from '../components/Avatar.vue';
import Icon from '../components/Icon.vue';
import { m } from '../api.js';
import { ask } from '../ask.js';
import { t } from '../i18n.js';
import { day, rupee } from '../util.js';

const d = ref(null);
const error = ref('');
const busy = ref('');
onMounted(async () => { try { d.value = await m('loans'); } catch (e) { error.value = e.message; } });

async function vote(loan, v) {
  const r = d.value.requests.find((x) => x.name === loan);
  const ok = await ask({
    title: t(v === 'Yes' ? 'Vote YES for this loan?' : 'Vote NO for this loan?'),
    lines: [[t('Member'), r.member_name], [t('Loan amount'), rupee(r.amount)]],
    note: t('You can change your vote until the treasurer decides.'),
    ok: t(v === 'Yes' ? 'Yes, vote YES' : 'Yes, vote NO'),
    tone: v === 'Yes' ? 'green' : 'red',
  });
  if (!ok) return;
  busy.value = loan;
  error.value = '';
  try { d.value = await m('vote', { loan, vote: v }); } catch (e) { error.value = e.message; } finally { busy.value = ''; }
}
const waiting = computed(() => (d.value?.requests || []).filter((r) => !r.my_vote).length);
</script>

<template>
  <div class="stack">
    <div v-if="error" class="error">{{ error }}</div>
    <div v-if="!d && !error" class="skeleton" />
    <template v-if="d">
      <p class="muted small intro">{{ t("Vote on other members' requests. You can change your vote until it is decided.") }}</p>
      <div v-if="waiting" class="card todo">🗳️ {{ waiting }} {{ t('waiting for your vote') }}</div>

      <div v-if="!d.requests.length" class="card empty"><span>🗳️</span>{{ t('No requests to vote on') }}</div>
      <article v-for="r in d.requests" :key="r.name" class="card">
        <div class="row">
          <Avatar :name="r.member_name" :photo="r.photo" />
          <div class="grow"><b>{{ r.member_name }}</b><div class="muted small">{{ t('Asked on') }} {{ day(r.application_date) }}</div></div>
          <b class="amt">{{ rupee(r.amount) }}</b>
        </div>
        <p v-if="r.purpose" class="purpose">“{{ r.purpose }}”</p>
        <div class="tally"><span>👍 {{ r.yes }} {{ t('Yes') }}</span><span>👎 {{ r.no }} {{ t('No') }}</span></div>
        <div class="votes">
          <button class="btn small yes" :class="{ picked: r.my_vote === 'Yes' }" :disabled="busy === r.name" @click="vote(r.name, 'Yes')"><Icon name="thumbs" :size="16" />{{ t('Yes') }}</button>
          <button class="btn small no" :class="{ picked: r.my_vote === 'No' }" :disabled="busy === r.name" @click="vote(r.name, 'No')">👎 {{ t('No') }}</button>
        </div>
        <p v-if="r.my_vote" class="muted small mine">{{ t('Your vote') }}: <b>{{ t(r.my_vote) }}</b></p>
      </article>
    </template>
  </div>
</template>

<style scoped>
.intro { margin: 0 2px; }
.todo { background: #f0f9ff; border-color: #bae6fd; color: #075985; font-weight: 700; }
.amt { font-size: 18px; }
.purpose { margin: 10px 0 0; font-size: 13.5px; font-style: italic; }
.tally { display: flex; gap: 14px; margin-top: 10px; font-size: 13px; font-weight: 700; color: var(--muted); }
.votes { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
.votes .btn { width: 100%; }
.votes .picked { outline: 2.5px solid currentColor; }
.mine { margin: 8px 0 0; }
</style>
