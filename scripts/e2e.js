const fs = require('fs');
const path = require('path');
const axios = require('axios');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const DB_PATH = path.join(__dirname, '..', 'data.json');

async function signupAndVerify(email, password, role, instance){
  console.log('signup', email, role);
  await instance.post(`${BASE}/api/signup`, { email, password, role });
  // read OTP from data.json
  const db = JSON.parse(fs.readFileSync(DB_PATH,'utf8'));
  const rec = db.otps && db.otps[email];
  if (!rec) throw new Error('otp missing for ' + email);
  const otp = rec.otp;
  console.log('using otp', otp);
  const v = await instance.post(`${BASE}/api/verify-otp`, { email, otp });
  console.log('verify-otp', v.status);
}

async function login(email, password, instance){
  const res = await instance.post(`${BASE}/api/login`, { email, password });
  if (res.status !== 200) throw new Error('login failed for ' + email);
}

async function getCsrfToken(instance){
  const res = await instance.get(`${BASE}/api/csrf-token`);
  return res.data.csrfToken;
}

async function run(){
  const author = { email: 'alice@example.com', password: 'StrongPass!234' };
  const collab = { email: 'colab@example.com', password: 'StrongPass!234' };
  const reviewer = { email: 'rev@example.com', password: 'StrongPass!234' };

  // Each role gets its own axios instance to maintain separate sessions
  const ax1 = axios.create();
  const ax2 = axios.create();
  const ax3 = axios.create();
  const ax4 = axios.create();

  // signup and verify
  await signupAndVerify(author.email, author.password, 'Author', ax1);
  await signupAndVerify(collab.email, collab.password, 'Collaborator', ax2);
  await signupAndVerify(reviewer.email, reviewer.password, 'Reviewer', ax3);

  // author login and submit paper
  await login(author.email, author.password, ax1);
  // prepare a small text as file
  const fileB64 = Buffer.from('This is a test paper content').toString('base64');
  const csrf1 = await getCsrfToken(ax1);
  const paperRes = await ax1.post(`${BASE}/api/papers`, { title: 'Test Paper', metadata:{}, fileBase64: fileB64, collaborators: [collab.email], reviewers: [reviewer.email] }, { headers: { 'x-csrf-token': csrf1 } });
  const paperJson = paperRes.data;
  console.log('paper created', paperJson);
  const pid = paperJson.id;

  // reviewer logs in and fetches paper
  await login(reviewer.email, reviewer.password, ax3);
  const getPaper = await ax3.get(`${BASE}/api/papers/${pid}`);
  console.log('reviewer get paper status', getPaper.status);

  // reviewer submits review
  const reviewB64 = Buffer.from('This is review content').toString('base64');
  const csrf3 = await getCsrfToken(ax3);
  const submitReview = await ax3.post(`${BASE}/api/papers/${pid}/reviews`, { reviewBase64: reviewB64 }, { headers: { 'x-csrf-token': csrf3 } });
  console.log('submit review status', submitReview.status);

  // collaborator logs in and reads review
  await login(collab.email, collab.password, ax2);
  // get dashboard to find reviews
  const dash = await ax2.get(`${BASE}/api/dashboard`);
  console.log('collab dashboard', dash.data.papers && dash.data.papers.length);

  // find reviews list from server by reading DB directly
  const db = JSON.parse(fs.readFileSync(DB_PATH,'utf8'));
  const reviews = Object.values(db.reviews||{}).filter(r=>r.pid===pid);
  if (reviews.length===0) throw new Error('no reviews found');
  const rid = reviews[0].id;
  const getReview = await ax2.get(`${BASE}/api/reviews/${rid}`);
  console.log('get review status', getReview.status);

  // collaborator issues decision
  const decision = 'Accept after minor revisions';
  const csrf2 = await getCsrfToken(ax2);
  const submitDecision = await ax2.post(`${BASE}/api/papers/${pid}/decision`, { decisionText: decision }, { headers: { 'x-csrf-token': csrf2 } });
  console.log('submit decision', submitDecision.status);

  // author retrieves decision and verifies signature flag
  const dec = await ax1.get(`${BASE}/api/papers/${pid}/decision`);
  console.log('final decision fetched, signature_valid:', dec.data.signature_valid);
  console.log('E2E completed successfully');
}

run().catch(e=>{ console.error('E2E failed', e.message); process.exit(1); });

