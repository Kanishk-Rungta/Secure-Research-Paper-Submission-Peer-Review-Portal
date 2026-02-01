async function getJSON(url){
  const r = await fetch(url, { credentials: 'same-origin' });
  return r.json();
}

async function loadProfile(){
  const me = await getJSON('/api/me');
  const p = document.getElementById('profile');
  if (me && me.user) {
    p.innerHTML = `<strong>${me.user.email}</strong> — Role: ${me.user.role}`;
  } else p.innerText = 'Not logged in';
}

function makePaperRow(p){
  return `<div class="paper-row" data-pid="${p.id}" style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04)"><strong>${p.title}</strong> <div>id: ${p.id}</div></div>`;
}

async function loadDashboard(){
  const d = await getJSON('/api/dashboard');
  const out = document.getElementById('dashboard');
  if (!d.ok) { out.innerText = JSON.stringify(d); return; }
  let html = `<h3>${d.role} Dashboard</h3>`;
  if (d.papers && d.papers.length===0) html += '<div>No assigned papers</div>';
  else html += d.papers.map(p => makePaperRow(p)).join('');
  out.innerHTML = html;

  // add action buttons depending on role
  const actions = document.getElementById('paper-actions');
  actions.innerHTML = '';
  if (d.role === 'Author') {
    actions.innerHTML = '<button id="submit-paper">Submit New Paper</button>';
    document.getElementById('submit-paper').addEventListener('click', openSubmitPaperModal);
  }

  // attach click handlers on rows
  document.querySelectorAll('.paper-row').forEach(el => {
    const pid = el.getAttribute('data-pid');
    const btns = [];
    btns.push(`<button data-action="view" data-pid="${pid}">View</button>`);
    if (d.role === 'Reviewer') btns.push(`<button data-action="review" data-pid="${pid}">Submit Review</button>`);
    if (d.role === 'Collaborator') btns.push(`<button data-action="decision" data-pid="${pid}">Issue Decision</button>`);
    if (d.role === 'Author' || d.role === 'Collaborator') btns.push(`<button data-action="view-decision" data-pid="${pid}">View Decision</button>`);
    el.insertAdjacentHTML('beforeend', `<div style="margin-top:8px">${btns.join(' ')}</div>`);
  });

  document.querySelectorAll('button[data-action]').forEach(b => b.addEventListener('click', handlePaperAction));
}

function showModal(html){
  const modal = document.getElementById('modal');
  document.getElementById('modal-content').innerHTML = html;
  modal.style.display = 'flex';
}

function closeModal(){
  const modal = document.getElementById('modal'); modal.style.display = 'none'; document.getElementById('modal-content').innerHTML = '';
}

async function handlePaperAction(e){
  const action = e.target.getAttribute('data-action');
  const pid = e.target.getAttribute('data-pid');
  if (action === 'view') {
    const j = await getJSON(`/api/papers/${pid}`);
    if (!j || j.error) { showModal(`<div>Error: ${JSON.stringify(j)}</div><button onclick="closeModal()">Close</button>`); return; }
    // verify hash client-side using SubtleCrypto
    const fileBytes = Uint8Array.from(atob(j.fileBase64), c=>c.charCodeAt(0));
    const digest = await crypto.subtle.digest('SHA-256', fileBytes);
    const hex = Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
    const ok = (hex === j.hash);
    const blobUrl = URL.createObjectURL(new Blob([fileBytes]));
    showModal(`<h4>${j.title}</h4><div>Integrity: ${ok?'<strong style="color:#6ee7b7">OK</strong>':'<strong style="color:#fb7185">MISMATCH</strong>'} (${hex})</div><div><a href="${blobUrl}" target="_blank">Download</a></div><button onclick="closeModal()">Close</button>`);
    return;
  }
  if (action === 'review') {
    // open file picker
    const input = document.getElementById('file-input');
    input.onchange = async () => {
      const f = input.files[0];
      if (!f) return;
      const base64 = await fileToBase64(f);
      const res = await postJSON(`/api/papers/${pid}/reviews`, { reviewBase64: base64 });
      showModal(`<div>${JSON.stringify(res)}</div><button onclick="closeModal()">Close</button>`);
      input.value = '';
    };
    input.click();
    return;
  }
  if (action === 'decision') {
    showModal(`<h4>Issue Final Decision</h4><textarea id="decision-text" style="width:100%;height:120px"></textarea><div style="margin-top:8px"><button id="submit-decision">Sign & Submit</button> <button onclick="closeModal()">Cancel</button></div>`);
    document.getElementById('submit-decision').addEventListener('click', async ()=>{
      const text = document.getElementById('decision-text').value;
      const r = await postJSON(`/api/papers/${pid}/decision`, { decisionText: text });
      showModal(`<div>${JSON.stringify(r)}</div><button onclick="closeModal()">Close</button>`);
    });
    return;
  }
  if (action === 'view-decision') {
    const j = await getJSON(`/api/papers/${pid}/decision`);
    if (!j || j.error) { showModal(`<div>Error: ${JSON.stringify(j)}</div><button onclick="closeModal()">Close</button>`); return; }
    const dec = j.decision;
    showModal(`<h4>Final Decision</h4><div>By: ${dec.by}</div><pre style="white-space:pre-wrap">${dec.decisionText}</pre><div>Signature valid: ${j.signature_valid}</div><button onclick="closeModal()">Close</button>`);
    return;
  }
}

function fileToBase64(file){
  return new Promise((res, rej) => {
    const fr = new FileReader(); fr.onload = ()=>{ const s = fr.result.split(',')[1]; res(s); }; fr.onerror = rej; fr.readAsDataURL(file);
  });
}

document.getElementById('logout-link').addEventListener('click', async (e)=>{
  e.preventDefault();
  // fetch CSRF token then logout
  try {
    const t = (await fetch('/api/csrf-token',{credentials:'same-origin'})).headers ? (await (await fetch('/api/csrf-token',{credentials:'same-origin'})).json()).csrfToken : null;
    await fetch('/api/logout',{method:'POST', headers: {'x-csrf-token': t}, credentials:'same-origin'});
  } catch (e) { await fetch('/api/logout',{method:'POST'}); }
  location.href = '/';
});

(async ()=>{ await loadProfile(); await loadDashboard(); })();
