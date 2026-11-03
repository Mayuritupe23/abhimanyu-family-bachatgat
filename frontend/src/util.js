import { lang } from './i18n.js';

const MR_MONTHS = ['जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रिल', 'मे', 'जून', 'जुलै', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const rupee = (v) => '₹' + Math.round(Number(v) || 0).toLocaleString('en-IN');

export function short(v) {
  v = Number(v) || 0;
  const a = Math.abs(v);
  const s = a >= 100000 ? (a / 100000).toFixed(1).replace(/\.0$/, '') + 'L' : a >= 1000 ? (a / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(Math.round(a));
  return (v < 0 ? '-₹' : '₹') + s;
}

const parse = (d) => new Date(String(d).slice(0, 10) + 'T00:00:00');

export function monthName(d, withYear = true) {
  const x = parse(d);
  const name = (lang.value === 'mr' ? MR_MONTHS : EN_MONTHS)[x.getMonth()];
  return withYear ? `${name} ${x.getFullYear()}` : name;
}

export const shortMonth = (d) => monthName(d, false).slice(0, lang.value === 'mr' ? 5 : 3);

export function day(d) {
  const x = parse(d);
  return `${x.getDate()} ${shortMonth(d)} ${x.getFullYear()}`;
}

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const initials = (n) => (n || '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
