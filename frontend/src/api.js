// Frappe calls. Same origin, so the session cookie goes along; the CSRF token comes from the
// page Frappe renders at /afbg.
const csrf = () => (window.csrf_token && window.csrf_token !== '{{ csrf_token }}' ? window.csrf_token : null);

export class SessionExpired extends Error {}

function clean(msg) {
  const text = String(msg ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  if (/Traceback|Failed to get method|Error\b.*line \d+/.test(text)) return 'Something went wrong on the server. Please try again in a few minutes.';
  return text || 'Something went wrong. Please try again.';
}

function errorFrom(body, status) {
  if (status === 403 && /Login|not permitted|session/i.test(JSON.stringify(body))) return new SessionExpired('Please log in again.');
  try {
    const msgs = body._server_messages && JSON.parse(body._server_messages).map((m) => JSON.parse(m).message);
    if (msgs && msgs.length) return new Error(clean(msgs.join('. ')));
  } catch (e) { /* fall through */ }
  return new Error(clean(body.message || body.exception || `Error ${status}`));
}

async function send(url, opts) {
  let res;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 25000);
  try {
    res = await fetch(url, { ...opts, signal: ctl.signal, credentials: 'same-origin' });
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'Network is slow. Please try again.' : 'No internet. Check mobile data or Wi-Fi.');
  } finally {
    clearTimeout(timer);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw errorFrom(body, res.status);
  return body.message;
}

export function call(method, args = {}) {
  const form = new URLSearchParams();
  Object.entries(args).forEach(([k, v]) => v !== undefined && v !== null && form.append(k, typeof v === 'object' ? JSON.stringify(v) : v));
  return send(`/api/method/${method}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', ...(csrf() ? { 'X-Frappe-CSRF-Token': csrf() } : {}) },
    body: form,
  });
}

export const m = (fn, args) => call(`nova_core.mobile.${fn}`, args);

export async function login(usr, pwd) {
  await call('login', { usr, pwd });
}

export async function logout() {
  await call('logout').catch(() => {});
}

export async function upload(file, isPrivate = true) {
  const form = new FormData();
  form.append('file', file, file.name || 'screenshot.jpg');
  form.append('is_private', isPrivate ? '1' : '0');
  form.append('folder', 'Home/Attachments');
  const r = await send('/api/method/upload_file', {
    method: 'POST',
    headers: { Accept: 'application/json', ...(csrf() ? { 'X-Frappe-CSRF-Token': csrf() } : {}) },
    body: form,
  });
  return r.file_url;
}

// profile photo: centre square, small enough to load fast in every list
export function squarePhoto(file, size = 400) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const c = document.createElement('canvas');
      c.width = c.height = size;
      c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      c.toBlob((b) => (b ? resolve(new File([b], 'profile.jpg', { type: 'image/jpeg' })) : reject(new Error('Could not read the photo'))), 'image/jpeg', 0.85);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error('Could not read the photo'));
    img.src = URL.createObjectURL(file);
  });
}

// big phone photos are shrunk before upload: quicker on weak signal, still readable
export function shrink(file, max = 1600) {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) return resolve(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => resolve(b ? new File([b], 'screenshot.jpg', { type: 'image/jpeg' }) : file), 'image/jpeg', 0.85);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}
