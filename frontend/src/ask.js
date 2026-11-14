// One confirm box for every action that changes money or a decision.
//   const ok = await ask({ title, lines: [[label, value]], note, ok, tone: 'red' })
// With `input` ({ label, value, max }) it asks for a number and resolves to it, or null on cancel.
import { reactive } from 'vue';

export const dialog = reactive({ open: false });

export function ask(opts) {
  return new Promise((resolve) => {
    Object.assign(dialog, { title: '', lines: [], note: '', ok: 'OK', tone: 'green', input: null, value: '', ...opts, open: true, resolve });
    if (opts.input) dialog.value = opts.input.value ?? '';
  });
}

export function close(ok) {
  dialog.open = false;
  dialog.resolve(dialog.input ? (ok ? +dialog.value || 0 : null) : ok);
}
