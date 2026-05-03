const express = require('express');
const path = require('path');
const multer = require('multer');
const { db, initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: path.join(__dirname, 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Only images (jpg, png, gif, webp) are allowed'));
    }
  }
});

app.set('trust proxy', true);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// List all posts with average rating
app.get('/api/posts', async (req, res) => {
  const result = await db.execute(`
    SELECT p.*,
      COALESCE(AVG(r.stars), 0) as avg_rating,
      COUNT(r.id) as rating_count
    FROM posts p
    LEFT JOIN ratings r ON p.id = r.post_id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `);
  res.json(result.rows);
});

// Create a post (with optional image file or GIF URL)
app.post('/api/posts', upload.single('image'), async (req, res) => {
  const { title, body, gif_url } = req.body;
  if (!title || !body) {
    return res.status(400).json({ error: 'Title and body are required' });
  }
  let image = null;
  if (req.file) {
    image = '/uploads/' + req.file.filename;
  } else if (gif_url) {
    image = gif_url;
  }
  const result = await db.execute({
    sql: 'INSERT INTO posts (title, body, image) VALUES (?, ?, ?)',
    args: [title, body, image]
  });
  res.status(201).json({ id: Number(result.lastInsertRowid) });
});

// Get single post
app.get('/api/posts/:id', async (req, res) => {
  const result = await db.execute({
    sql: `SELECT p.*,
      COALESCE(AVG(r.stars), 0) as avg_rating,
      COUNT(r.id) as rating_count
    FROM posts p
    LEFT JOIN ratings r ON p.id = r.post_id
    WHERE p.id = ?
    GROUP BY p.id`,
    args: [req.params.id]
  });
  if (result.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
  res.json(result.rows[0]);
});

// Rate a post
app.post('/api/posts/:id/rate', async (req, res) => {
  const { stars } = req.body;
  if (!stars || stars < 1 || stars > 5) {
    return res.status(400).json({ error: 'Stars must be between 1 and 5' });
  }
  const post = await db.execute({ sql: 'SELECT id FROM posts WHERE id = ?', args: [req.params.id] });
  if (post.rows.length === 0) return res.status(404).json({ error: 'Post not found' });

  const ip = req.ip;
  await db.execute({
    sql: `INSERT INTO ratings (post_id, stars, voter_ip)
      VALUES (?, ?, ?)
      ON CONFLICT(post_id, voter_ip) DO UPDATE SET stars = excluded.stars`,
    args: [req.params.id, stars, ip]
  });

  res.json({ success: true });
});

// Get current user's rating for a post
app.get('/api/posts/:id/my-rating', async (req, res) => {
  const result = await db.execute({
    sql: 'SELECT stars FROM ratings WHERE post_id = ? AND voter_ip = ?',
    args: [req.params.id, req.ip]
  });
  res.json({ stars: result.rows.length ? result.rows[0].stars : null });
});

// Initialize DB then start server
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
});
