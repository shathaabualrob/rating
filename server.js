const express = require('express');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { db, initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const IMGBB_API_KEY = process.env.IMGBB_API_KEY || 'e0451b221477d4696d1002e0d7a7adc0';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// In-memory admin tokens
const activeTokens = new Set();

// Configure multer
const upload = multer({
  storage: multer.memoryStorage(),
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

// Upload image to ImgBB
async function uploadToImgBB(fileBuffer) {
  const base64 = fileBuffer.toString('base64');
  const formData = new URLSearchParams();
  formData.append('key', IMGBB_API_KEY);
  formData.append('image', base64);

  const res = await fetch('https://api.imgbb.com/1/upload', {
    method: 'POST',
    body: formData
  });
  const data = await res.json();
  if (data.success) {
    return data.data.url;
  }
  throw new Error('ImgBB upload failed');
}

// Admin middleware
function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !activeTokens.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.set('trust proxy', true);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// === PUBLIC API ===

// List posts with sorting, search, category filter, pagination
app.get('/api/posts', async (req, res) => {
  const { sort = 'newest', search = '', category = '', page = '1' } = req.query;
  const limit = 10;
  const offset = (parseInt(page) - 1) * limit;

  let where = [];
  let args = [];

  if (search) {
    where.push("p.title LIKE ?");
    args.push(`%${search}%`);
  }
  if (category) {
    where.push("p.category = ?");
    args.push(category);
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  let orderBy;
  switch (sort) {
    case 'highest':
      orderBy = 'pinned DESC, avg_rating DESC, p.created_at DESC';
      break;
    case 'most':
      orderBy = 'pinned DESC, rating_count DESC, p.created_at DESC';
      break;
    default:
      orderBy = 'pinned DESC, p.created_at DESC';
  }

  const result = await db.execute({
    sql: `SELECT p.*,
      COALESCE(AVG(r.stars), 0) as avg_rating,
      COUNT(r.id) as rating_count
    FROM posts p
    LEFT JOIN ratings r ON p.id = r.post_id
    ${whereClause}
    GROUP BY p.id
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?`,
    args: [...args, limit, offset]
  });

  // Get total count for pagination
  const countResult = await db.execute({
    sql: `SELECT COUNT(*) as total FROM posts p ${whereClause}`,
    args: args
  });

  res.json({
    posts: result.rows,
    total: countResult.rows[0].total,
    page: parseInt(page),
    hasMore: offset + limit < countResult.rows[0].total
  });
});

// Create a post
app.post('/api/posts', upload.single('image'), async (req, res) => {
  const { title, body, gif_url, category } = req.body;
  if (!title || !body) {
    return res.status(400).json({ error: 'Title and body are required' });
  }
  const validCategories = ['general', 'food', 'music', 'movies', 'tech', 'other'];
  const postCategory = validCategories.includes(category) ? category : 'general';

  let image = null;
  if (req.file) {
    image = await uploadToImgBB(req.file.buffer);
  } else if (gif_url) {
    image = gif_url;
  }
  const result = await db.execute({
    sql: 'INSERT INTO posts (title, body, image, category) VALUES (?, ?, ?, ?)',
    args: [title, body, image, postCategory]
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

// Get current user's rating
app.get('/api/posts/:id/my-rating', async (req, res) => {
  const result = await db.execute({
    sql: 'SELECT stars FROM ratings WHERE post_id = ? AND voter_ip = ?',
    args: [req.params.id, req.ip]
  });
  res.json({ stars: result.rows.length ? result.rows[0].stars : null });
});

// Get comments for a post
app.get('/api/posts/:id/comments', async (req, res) => {
  const result = await db.execute({
    sql: 'SELECT id, body, created_at FROM comments WHERE post_id = ? ORDER BY created_at ASC',
    args: [req.params.id]
  });
  res.json(result.rows);
});

// Add comment
app.post('/api/posts/:id/comments', async (req, res) => {
  const { body } = req.body;
  if (!body || !body.trim()) {
    return res.status(400).json({ error: 'Comment body is required' });
  }

  const ip = req.ip;
  const postId = req.params.id;

  // Check 60s cooldown
  const recent = await db.execute({
    sql: `SELECT id FROM comments WHERE post_id = ? AND commenter_ip = ? AND created_at > datetime('now', '-60 seconds')`,
    args: [postId, ip]
  });
  if (recent.rows.length > 0) {
    return res.status(429).json({ error: 'Please wait before commenting again' });
  }

  await db.execute({
    sql: 'INSERT INTO comments (post_id, body, commenter_ip) VALUES (?, ?, ?)',
    args: [postId, body.trim(), ip]
  });

  res.status(201).json({ success: true });
});

// === ADMIN API ===

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  const token = crypto.randomUUID();
  activeTokens.add(token);
  res.json({ token });
});

app.delete('/api/admin/posts/:id', requireAdmin, async (req, res) => {
  await db.execute({ sql: 'DELETE FROM posts WHERE id = ?', args: [req.params.id] });
  res.json({ success: true });
});

app.patch('/api/admin/posts/:id/pin', requireAdmin, async (req, res) => {
  const post = await db.execute({ sql: 'SELECT pinned FROM posts WHERE id = ?', args: [req.params.id] });
  if (post.rows.length === 0) return res.status(404).json({ error: 'Post not found' });

  const newPinned = post.rows[0].pinned ? 0 : 1;
  await db.execute({ sql: 'UPDATE posts SET pinned = ? WHERE id = ?', args: [newPinned, req.params.id] });
  res.json({ pinned: newPinned });
});

// Initialize DB then start server
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
});
