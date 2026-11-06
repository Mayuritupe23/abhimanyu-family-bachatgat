// The month's two sheets as files, same layout as the desk's Monthly Sheet:
//   Paise Bharna (what each member pays) and the month-end Statement.
// Image = drawn on a canvas (no library); Excel = CSV with a BOM so Excel shows Marathi correctly.

const MR_MONTHS = ['जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रिल', 'मे', 'जून', 'जुलै', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर'];
const EN_MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
const mrDigits = (s) => String(s).replace(/\d/g, (d) => '०१२३४५६७८९'[d]);
const num = (v) => Math.round(v || 0).toLocaleString('en-IN');
const parse = (d) => new Date(String(d).slice(0, 10) + 'T00:00:00');

export function demandSpec(d) {
  const m = parse(d.month);
  const due = parse(d.due_date);
  const rows = d.rows.map((r) => [r.no, r.member_name, r.loan, r.interest, r.saving, '', r.saving + r.interest]);
  const sum = (i) => rows.reduce((a, r) => a + (+r[i] || 0), 0);
  return {
    file: `paise-bharna-${d.month.slice(0, 7)}`,
    title: `${MR_MONTHS[m.getMonth()]} ${mrDigits(m.getFullYear())} – या महिन्याचे पैसे भरणा`,
    meta: [`Interest ${d.interest_rate}%`, `Monthly ₹${num(d.monthly_saving)}`,
      `शेवटची तारीख ${mrDigits(`${String(due.getDate()).padStart(2, '0')}/${String(due.getMonth() + 1).padStart(2, '0')}/${due.getFullYear()}`)}`],
    cols: [['NO', 'c', 50], ['NAME', 'l', 230], ['BALANCE LOAN', 'r', 140, '#2563eb'], ['INTEREST', 'r', 110],
      ['MONTHLY', 'r', 110], ['EMI', 'r', 100, null, '#fef9c3'], ['TOTAL TO PAY', 'r', 140]],
    rows,
    total: ['', 'TOTAL', sum(2), sum(3), sum(4), '', sum(6)],
    note: 'EMI खाना भरा, TOTAL मध्ये EMI जोडा. उशीर झाल्यास दंड लागेल.',
  };
}

export function statementSpec(d) {
  const m = parse(d.month);
  // only approved payments count; a sent-but-not-approved one shows as not paid yet
  const rows = d.rows.map((r) => {
    const ok = r.state === 'paid';
    return [r.no, r.member_name, ok ? r.saving : 0, r.loan, ok ? r.interest : 0, ok ? r.emi : 0, ok ? r.fine : 0, ok ? r.total : 0, ok ? r.balance : r.loan];
  });
  const sum = (i) => rows.reduce((a, r) => a + (+r[i] || 0), 0);
  const unpaid = d.rows.filter((r) => r.state !== 'paid').map((r) => r.member_name);
  return {
    file: `statement-${d.month.slice(0, 7)}`,
    title: 'FINANCIAL STATEMENT / REPORT',
    subtitle: `MONTH: ${EN_MONTHS[m.getMonth()]} ${m.getFullYear()}`,
    cols: [['NO', 'c', 50], ['NAME', 'l', 220], ['SHARES', 'r', 100], ['LOAN', 'r', 110], ['INTEREST', 'r', 100],
      ['EMI', 'r', 100], ['PENALTY', 'r', 100], ['TOTAL RE', 'r', 110], ['BALANCE LOAN', 'r', 130]],
    rows,
    total: ['', 'TOTAL', sum(2), sum(3), sum(4), sum(5), sum(6), sum(7), sum(8)],
    note: unpaid.length ? `बाकी: ${unpaid.join(', ')}` : 'सर्वांनी पैसे भरले ✔',
  };
}

export function drawSheet(spec) {
  const S = 2; // sharp on phones
  const pad = 28, rowH = 34, headH = 40;
  const width = spec.cols.reduce((a, c) => a + c[2], 0) + pad * 2;
  const top = pad + 40 + (spec.subtitle ? 26 : 0) + (spec.meta ? 30 : 0) + 10;
  const height = top + headH + rowH * (spec.rows.length + 1) + 50;
  const cv = document.createElement('canvas');
  cv.width = width * S;
  cv.height = height * S;
  const c = cv.getContext('2d');
  c.scale(S, S);
  const font = (w, s) => `${w} ${s}px "Noto Sans Devanagari", Inter, Arial, sans-serif`;

  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, width, height);
  c.fillStyle = '#14532d';
  c.font = font(800, 24);
  c.textAlign = 'center';
  c.fillText(spec.title, width / 2, pad + 24);
  let y = pad + 40;
  if (spec.subtitle) {
    c.fillStyle = '#16a34a';
    c.font = font(700, 16);
    c.fillText(spec.subtitle, width / 2, y + 12);
    y += 26;
  }
  if (spec.meta) {
    c.fillStyle = '#b45309';
    c.font = font(700, 14);
    c.fillText(spec.meta.join('     ·     '), width / 2, y + 14);
  }
  y = top;

  const xs = [];
  let x = pad;
  spec.cols.forEach((col) => { xs.push(x); x += col[2]; });
  const text = (v, i, yy, bold, color) => {
    const [, align, w] = spec.cols[i];
    c.fillStyle = color || '#0f172a';
    c.font = font(bold ? 700 : 500, 14);
    c.textAlign = align === 'r' ? 'right' : align === 'c' ? 'center' : 'left';
    const tx = align === 'r' ? xs[i] + w - 10 : align === 'c' ? xs[i] + w / 2 : xs[i] + 10;
    c.fillText(typeof v === 'number' ? num(v) : String(v ?? ''), tx, yy);
  };

  c.fillStyle = '#15803d';
  c.fillRect(pad, y, width - pad * 2, headH);
  spec.cols.forEach((col, i) => text(col[0], i, y + 26, true, '#ffffff'));
  y += headH;
  spec.rows.forEach((r, ri) => {
    c.fillStyle = ri % 2 ? '#f0fdf4' : '#ffffff';
    c.fillRect(pad, y, width - pad * 2, rowH);
    spec.cols.forEach((col, i) => { if (col[4]) { c.fillStyle = col[4]; c.fillRect(xs[i], y, col[2], rowH); } });
    r.forEach((v, i) => text(v, i, y + 22, i === 1 || i === r.length - 1, spec.cols[i][3]));
    y += rowH;
  });
  c.fillStyle = '#dcfce7';
  c.fillRect(pad, y, width - pad * 2, rowH);
  spec.total.forEach((v, i) => text(v, i, y + 22, true, '#14532d'));
  y += rowH;

  c.strokeStyle = '#bbf7d0';
  c.lineWidth = 1;
  c.strokeRect(pad, top, width - pad * 2, y - top);
  xs.slice(1).forEach((gx) => { c.beginPath(); c.moveTo(gx, top); c.lineTo(gx, y); c.stroke(); });

  c.fillStyle = '#64748b';
  c.font = font(500, 13);
  c.textAlign = 'left';
  c.fillText(spec.note, pad, y + 26);
  c.textAlign = 'right';
  c.fillText('Abhimanyu Family Bachat Gat', width - pad, y + 26);
  return cv;
}

// several sheets one under the other (the whole month = Paise Bharna + Statement)
export function drawMany(specs) {
  const cvs = specs.map(drawSheet);
  if (cvs.length === 1) return cvs[0];
  const gap = 40;
  const out = document.createElement('canvas');
  out.width = Math.max(...cvs.map((c) => c.width));
  out.height = cvs.reduce((a, c) => a + c.height, 0) + gap * (cvs.length - 1);
  const c = out.getContext('2d');
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, out.width, out.height);
  let y = 0;
  cvs.forEach((cv, i) => {
    c.drawImage(cv, (out.width - cv.width) / 2, y);
    y += cv.height;
    if (i < cvs.length - 1) { c.fillStyle = '#e2e8f0'; c.fillRect(0, y + gap / 2 - 1, out.width, 2); y += gap; }
  });
  return out;
}

const list = (s) => (Array.isArray(s) ? s : [s]);
export const imageBlob = (spec) => new Promise((resolve) => drawMany(list(spec)).toBlob(resolve, 'image/png'));

export function csvBlob(spec) {
  const cell = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = list(spec).flatMap((sp, i) => [i ? [] : null, i ? [] : null, [sp.title], sp.subtitle ? [sp.subtitle] : null,
    sp.meta ? [sp.meta.join(' | ')] : null, [], sp.cols.map((c) => c[0]), ...sp.rows, sp.total, [], [sp.note]].filter(Boolean));
  // BOM so Excel opens the Marathi text as UTF-8
  return new Blob(['﻿' + lines.map((l) => l.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
}

export function saveFile(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

// phone share sheet (WhatsApp, Drive...) when the browser can share files, else a plain download
export async function shareImage(spec, name) {
  const blob = await imageBlob(spec);
  const file = new File([blob], `${name}.png`, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled';
    }
  }
  saveFile(blob, file.name);
  return 'downloaded';
}
