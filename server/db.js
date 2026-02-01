const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data.json');

function readDB() {
  try {
    const s = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(s);
  } catch (e) {
    return { users: {}, papers: {}, reviews: {}, otps: {}, logs: [] };
  }
}

function writeDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

function logEvent(db, entry) {
  db.logs = db.logs || [];
  db.logs.push({ ts: new Date().toISOString(), ...entry });
  writeDB(db);
}

module.exports = { DB_PATH, readDB, writeDB, logEvent };
