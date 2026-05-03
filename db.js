const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.TURSO_URL || 'libsql://rating-shathaabualrob.aws-eu-west-1.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzc4NDExOTgsImlkIjoiMDE5ZGVmOTctNzAwMS03YWY5LWJjZTctY2RlOWFmYjI2ZWY1IiwicmlkIjoiNWY4ZDg0MjItNjQwNS00ZDJmLWJiNDctMmJjM2FjYzM0MjFjIn0.Kk8uhc4fRSumpu_0eGLR_ywb3YkKlsniKfrHgeH56mbpwZueHyf6o-suxTU-KRn7xuQI-Mgrozx0tFA7L6eJBw',
});

async function initDb() {
  await db.batch([
    `CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      image TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
      voter_ip TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      UNIQUE(post_id, voter_ip)
    )`
  ]);
}

module.exports = { db, initDb };
