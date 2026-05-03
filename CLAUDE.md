# Rating - Anonymous Post Rating Website

## Overview
Simple anonymous voting website where anyone can create posts and rate them 1-5 stars. No authentication.

## Tech Stack
- Node.js + Express 5
- SQLite via better-sqlite3
- Vanilla HTML/CSS/JS frontend (no framework, no bundler)

## Run
```
npm start
```
Server at http://localhost:3000

## Project Structure
```
Rating/
├── server.js        # Express app + all API routes
├── db.js            # SQLite init, creates tables, exports db instance
├── rating.db        # SQLite database file (auto-created on first run)
├── public/
│   ├── index.html   # Home: post list + create form
│   ├── post.html    # Single post view + star rating widget
│   ├── style.css    # All styles (700px centered, cards, stars)
│   └── app.js       # All frontend JS (page detection, fetch calls, DOM)
```

## Database Schema
- **posts**: id, title, body, created_at
- **ratings**: id, post_id, stars (1-5), voter_ip, created_at
  - UNIQUE(post_id, voter_ip) prevents duplicate votes per IP
  - ON CONFLICT → UPDATE (users can change their rating)

## API Endpoints
| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | /api/posts | — | List posts with avg_rating, rating_count |
| POST | /api/posts | {title, body} | Create post |
| GET | /api/posts/:id | — | Single post with avg_rating |
| POST | /api/posts/:id/rate | {stars: 1-5} | Rate (IP-deduped) |
| GET | /api/posts/:id/my-rating | — | Current user's rating by IP |

## Key Decisions
- Duplicate vote prevention: IP-based (req.ip), enforced by DB constraint
- Single app.js for frontend: detects page via DOM element presence
- No templating engine: client-side rendering with fetch + innerHTML
- XSS prevention: escapeHtml() utility in app.js
- Port: 3000 (configurable via PORT env var)
- trust proxy enabled for correct IP behind reverse proxy
