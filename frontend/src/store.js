import { reactive } from 'vue';
import { m } from './api.js';
import { setLang } from './i18n.js';

// boot: undefined = not asked yet, null = logged out, object = logged in
export const store = reactive({ boot: undefined });

export async function loadBoot() {
  try {
    store.boot = await m('boot');
    setLang(localStorage.getItem('afbg-lang') || (store.boot.lang === 'mr' ? 'mr' : 'en'));
  } catch (e) {
    store.boot = null;
  }
  return store.boot;
}
