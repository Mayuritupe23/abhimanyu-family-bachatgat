<script setup>
import { close, dialog } from '../ask.js';
import { t } from '../i18n.js';
</script>

<template>
  <transition name="fade">
    <div v-if="dialog.open" class="ask-wrap" @click.self="close(false)">
      <div class="ask" role="alertdialog" aria-modal="true" :class="dialog.tone">
        <div class="head"><span class="dot" />{{ dialog.title }}</div>
        <dl v-if="dialog.lines.length">
          <template v-for="[k, v] in dialog.lines" :key="k"><dt>{{ k }}</dt><dd>{{ v }}</dd></template>
        </dl>
        <label v-if="dialog.input" class="field">{{ dialog.input.label }}
          <input v-model="dialog.value" class="input" type="number" inputmode="numeric" min="0" :max="dialog.input.max" placeholder="0" />
        </label>
        <p v-if="dialog.note" class="note">{{ dialog.note }}</p>
        <div class="btns">
          <button class="btn ghost" @click="close(false)">{{ t('Cancel') }}</button>
          <button class="btn go" @click="close(true)">{{ dialog.ok }}</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.ask-wrap { position: fixed; inset: 0; z-index: 80; background: rgba(15, 23, 42, .55); display: flex; align-items: flex-end; justify-content: center; padding: 12px; }
.ask { width: 100%; max-width: 440px; background: #fff; border-radius: 20px; padding: 18px; display: flex; flex-direction: column; gap: 12px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, .25); border-top: 5px solid #16a34a; }
.ask.red { border-top-color: #dc2626; }
.head { font-size: 17px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
.dot { width: 10px; height: 10px; border-radius: 50%; background: #16a34a; flex: none; }
.red .dot { background: #dc2626; }
dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; background: var(--soft); border-radius: 12px; padding: 10px 12px; font-size: 14px; }
dt { color: var(--muted); font-weight: 600; }
dd { margin: 0; font-weight: 800; text-align: right; }
.note { margin: 0; font-size: 13px; line-height: 1.45; color: #92400e; background: #fffbeb; border-radius: 12px; padding: 10px 12px; }
.red .note { color: #991b1b; background: #fef2f2; }
.btns { display: grid; grid-template-columns: 1fr 1.4fr; gap: 10px; }
.go { background: #15803d; }
.red .go { background: #dc2626; }
@media (min-width: 600px) { .ask-wrap { align-items: center; } }
</style>
