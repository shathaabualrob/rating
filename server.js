const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', true);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// List all posts with average rating
app.get('/api/posts', (req, res) => {
  const posts = db.prepare(`
    SELECT p.*,
      COALESCE(AVG(r.stars), 0) as avg_rating,
      COUNT(r.id) as rating_count
    FROM posts p
    LEFT JOIN ratings r ON p.id = r.post_id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all();
  res.json(posts);
});

// Create a post
app.post('/api/posts', (req, res) => {
  const { title, body } = req.body;
  if (!title || !body) {
    return res.status(400).json({ error: 'Title and body are required' });
  }
  const result = db.prepare('INSERT INTO posts (title, body) VALUES (?, ?)').run(title, body);
  res.status(201).json({ id: result.lastInsertRowid });
});

// Get single post
app.get('/api/posts/:id', (req, res) => {
  const post = db.prepare(`
    SELECT p.*,
      COALESCE(AVG(r.stars), 0) as avg_rating,
      COUNT(r.id) as rating_count
    FROM posts p
    LEFT JOIN ratings r ON p.id = r.post_id
    WHERE p.id = ?
    GROUP BY p.id
  `).get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(post);
});

// Rate a post
app.post('/api/posts/:id/rate', (req, res) => {
  const { stars } = req.body;
  if (!stars || stars < 1 || stars > 5) {
    return res.status(400).json({ error: 'Stars must be between 1 and 5' });
  }
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const ip = req.ip;
  db.prepare(`
    INSERT INTO ratings (post_id, stars, voter_ip)
    VALUES (?, ?, ?)
    ON CONFLICT(post_id, voter_ip) DO UPDATE SET stars = excluded.stars
  `).run(req.params.id, stars, ip);

  res.json({ success: true });
});

// Get current user's rating for a post
app.get('/api/posts/:id/my-rating', (req, res) => {
  const rating = db.prepare(
    'SELECT stars FROM ratings WHERE post_id = ? AND voter_ip = ?'
  ).get(req.params.id, req.ip);
  res.json({ stars: rating ? rating.stars : null });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
