// Shared utilities for all pages
async function postJSON(url, body) {
  const token = await getCsrf();
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token || '' },
    credentials: 'same-origin',
    body: JSON.stringify(body)
  });
  return r.json();
}

let _csrf;
async function getCsrf() {
  if (_csrf) return _csrf;
  try {
    const r = await fetch('/api/csrf-token', { credentials: 'same-origin' });
    const j = await r.json();
    _csrf = j.csrfToken;
    return _csrf;
  } catch (e) {
    return null;
  }
}

function showMessage(elementId, message, type = 'success') {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.className = `message ${type}`;
  el.innerText = message;
  el.style.display = 'block';
}
