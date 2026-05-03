const GIPHY_API_KEY = '9ZRvg8F4KyslwEtn46ZgtN4sHvjlVwmM';

// === UTILITIES ===
function renderStars(avg, count) {
  const rounded = Math.round(avg);
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    stars += i <= rounded ? '★' : '☆';
  }
  return `<span class="stars">${stars}</span> <span>${avg.toFixed(1)} (${count} rating${count !== 1 ? 's' : ''})</span>`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function timeAgo(dateStr) {
  const date = new Date(dateStr + 'Z');
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  return Math.floor(seconds / 86400) + 'd ago';
}

// === DARK MODE ===
const themeToggle = document.getElementById('theme-toggle');
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
});

// === STATE ===
let currentPage = 1;
let allPostsLoaded = false;
let selectedGif = null;
let searchTimeout = null;

// === ELEMENTS ===
const postsContainer = document.getElementById('posts');
const submitBtn = document.getElementById('submit-btn');
const titleInput = document.getElementById('title');
const bodyInput = document.getElementById('body');
const categoryInput = document.getElementById('category');
const imageInput = document.getElementById('image');
const fileName = document.getElementById('file-name');
const gifBtn = document.getElementById('gif-btn');
const gifPicker = document.getElementById('gif-picker');
const gifSearch = document.getElementById('gif-search');
const gifResults = document.getElementById('gif-results');
const gifUrlInput = document.getElementById('gif-url');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');
const modalClose = document.getElementById('modal-close');
const loadMoreBtn = document.getElementById('load-more');
const searchInput = document.getElementById('search');
const sortSelect = document.getElementById('sort');
const categoryFilter = document.getElementById('category-filter');

// === FILE INPUT ===
imageInput.addEventListener('change', () => {
  if (imageInput.files.length) {
    fileName.textContent = imageInput.files[0].name;
    fileName.classList.add('has-file');
    selectedGif = null;
    gifUrlInput.value = '';
    gifResults.querySelectorAll('img').forEach(img => img.classList.remove('selected'));
  } else {
    fileName.textContent = 'Attach image (optional)';
    fileName.classList.remove('has-file');
  }
});

// === GIF PICKER ===
gifBtn.addEventListener('click', () => {
  gifPicker.classList.toggle('hidden');
  if (!gifPicker.classList.contains('hidden')) {
    gifSearch.focus();
    loadTrendingGifs();
  }
});

gifSearch.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const query = gifSearch.value.trim();
    if (query) searchGifs(query);
    else loadTrendingGifs();
  }, 400);
});

async function loadTrendingGifs() {
  try {
    const res = await fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=18&rating=g`);
    const data = await res.json();
    renderGifResults(data.data);
  } catch (e) {
    gifResults.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;">Could not load GIFs</p>';
  }
}

async function searchGifs(query) {
  try {
    const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=18&rating=g`);
    const data = await res.json();
    renderGifResults(data.data);
  } catch (e) {
    gifResults.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;">Search failed</p>';
  }
}

function renderGifResults(gifs) {
  gifResults.innerHTML = gifs.map(gif => {
    const url = gif.images.fixed_height.url;
    const preview = gif.images.fixed_width_small.url;
    return `<img src="${preview}" data-url="${url}" alt="${escapeHtml(gif.title)}">`;
  }).join('');

  gifResults.querySelectorAll('img').forEach(img => {
    img.addEventListener('click', () => {
      gifResults.querySelectorAll('img').forEach(i => i.classList.remove('selected'));
      img.classList.add('selected');
      selectedGif = img.dataset.url;
      gifUrlInput.value = selectedGif;
      imageInput.value = '';
      fileName.textContent = 'Attach image (optional)';
      fileName.classList.remove('has-file');
    });
  });
}

// === SUBMIT POST ===
submitBtn.addEventListener('click', async () => {
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  if (!title || !body) return;

  submitBtn.disabled = true;
  const formData = new FormData();
  formData.append('title', title);
  formData.append('body', body);
  formData.append('category', categoryInput.value);

  if (imageInput.files.length) {
    formData.append('image', imageInput.files[0]);
  } else if (selectedGif) {
    formData.append('gif_url', selectedGif);
  }

  const res = await fetch('/api/posts', { method: 'POST', body: formData });

  if (res.ok) {
    titleInput.value = '';
    bodyInput.value = '';
    categoryInput.value = 'general';
    imageInput.value = '';
    fileName.textContent = 'Attach image (optional)';
    fileName.classList.remove('has-file');
    selectedGif = null;
    gifUrlInput.value = '';
    gifPicker.classList.add('hidden');
    gifSearch.value = '';
    gifResults.innerHTML = '';
    showToast('Post created!');
    currentPage = 1;
    loadPosts(true);
  } else {
    showToast('Failed to create post', 'error');
  }
  submitBtn.disabled = false;
});

// === TOOLBAR (Search, Sort, Filter) ===
let toolbarTimeout;
searchInput.addEventListener('input', () => {
  clearTimeout(toolbarTimeout);
  toolbarTimeout = setTimeout(() => { currentPage = 1; loadPosts(true); }, 400);
});
sortSelect.addEventListener('change', () => { currentPage = 1; loadPosts(true); });
categoryFilter.addEventListener('change', () => { currentPage = 1; loadPosts(true); });

// === LOAD POSTS ===
async function loadPosts(reset = false) {
  if (reset) {
    postsContainer.innerHTML = '<div class="spinner"></div>';
  }

  const params = new URLSearchParams({
    sort: sortSelect.value,
    search: searchInput.value.trim(),
    category: categoryFilter.value,
    page: currentPage
  });

  const res = await fetch(`/api/posts?${params}`);
  const data = await res.json();

  if (reset) postsContainer.innerHTML = '';

  if (data.posts.length === 0 && currentPage === 1) {
    postsContainer.innerHTML = '<p class="empty">No posts yet. Create one above!</p>';
    loadMoreBtn.classList.add('hidden');
    return;
  }

  const html = data.posts.map(post => `
    <div class="post-card" data-id="${post.id}">
      ${post.pinned ? '<span class="pin-badge">📌 Pinned</span>' : ''}
      <h3>${escapeHtml(post.title)}</h3>
      <p class="snippet">${escapeHtml(post.body.slice(0, 120))}${post.body.length > 120 ? '...' : ''}</p>
      ${post.image ? `<img src="${post.image}" alt="post image">` : ''}
      <div class="meta">
        <span>${renderStars(post.avg_rating, post.rating_count)}</span>
        <span class="category-tag">${escapeHtml(post.category || 'general')}</span>
      </div>
    </div>
  `).join('');

  if (reset) {
    postsContainer.innerHTML = html;
  } else {
    postsContainer.insertAdjacentHTML('beforeend', html);
  }

  // Show/hide load more
  if (data.hasMore) {
    loadMoreBtn.classList.remove('hidden');
  } else {
    loadMoreBtn.classList.add('hidden');
  }

  // Attach click handlers
  postsContainer.querySelectorAll('.post-card').forEach(card => {
    card.addEventListener('click', () => openPost(card.dataset.id));
  });
}

// Load More
loadMoreBtn.addEventListener('click', () => {
  currentPage++;
  loadPosts(false);
});

// === POST MODAL ===
async function openPost(id) {
  modal.classList.remove('hidden');
  modalBody.innerHTML = '<div class="spinner"></div>';

  const [postRes, myRatingRes, commentsRes] = await Promise.all([
    fetch(`/api/posts/${id}`),
    fetch(`/api/posts/${id}/my-rating`),
    fetch(`/api/posts/${id}/comments`)
  ]);

  const post = await postRes.json();
  const myRating = await myRatingRes.json();
  const comments = await commentsRes.json();

  renderModal(post, myRating.stars, comments);

  function renderModal(post, userStars, comments) {
    modalBody.innerHTML = `
      <h2>${escapeHtml(post.title)}</h2>
      <span class="category-tag">${escapeHtml(post.category || 'general')}</span>
      <p class="body">${escapeHtml(post.body)}</p>
      ${post.image ? `<img src="${post.image}" alt="post image">` : ''}
      <div class="rating-section">
        <div class="avg-rating">${renderStars(post.avg_rating, post.rating_count)}</div>
        <p><strong>Your rating:</strong></p>
        <div class="stars-interactive" id="star-widget">
          ${[1,2,3,4,5].map(i => `<span class="star ${i <= (userStars || 0) ? 'active' : 'inactive'}" data-star="${i}">★</span>`).join('')}
        </div>
        <p class="your-rating">${userStars ? `You rated this ${userStars} star${userStars !== 1 ? 's' : ''}` : 'Click a star to rate'}</p>
        <button class="share-btn" id="share-btn">📋 Copy Share Link</button>
      </div>
      <div class="comments-section">
        <h3>Comments (${comments.length})</h3>
        <div id="comments-list">
          ${comments.map(c => `
            <div class="comment">
              <div>${escapeHtml(c.body)}</div>
              <div class="comment-time">${timeAgo(c.created_at)}</div>
            </div>
          `).join('') || '<p style="color:var(--text-muted);font-size:0.9rem;">No comments yet</p>'}
        </div>
        <div class="comment-form">
          <input type="text" id="comment-input" placeholder="Write a comment..." maxlength="500">
          <button id="comment-btn">Send</button>
        </div>
      </div>
    `;

    // Star click handlers
    document.querySelectorAll('#star-widget .star').forEach(star => {
      star.addEventListener('click', async () => {
        const stars = parseInt(star.dataset.star);
        const rateRes = await fetch(`/api/posts/${id}/rate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stars })
        });
        if (rateRes.ok) {
          showToast('Rating submitted!');
          const updated = await (await fetch(`/api/posts/${id}`)).json();
          renderModal(updated, stars, comments);
          loadPosts(true);
        }
      });
    });

    // Share button
    document.getElementById('share-btn').addEventListener('click', () => {
      const url = `${window.location.origin}?post=${id}`;
      navigator.clipboard.writeText(url).then(() => {
        showToast('Link copied to clipboard!');
      });
    });

    // Comment submit
    const commentInput = document.getElementById('comment-input');
    const commentBtn = document.getElementById('comment-btn');

    commentBtn.addEventListener('click', submitComment);
    commentInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitComment();
    });

    async function submitComment() {
      const body = commentInput.value.trim();
      if (!body) return;
      commentBtn.disabled = true;

      const res = await fetch(`/api/posts/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body })
      });

      if (res.ok) {
        commentInput.value = '';
        showToast('Comment added!');
        const updatedComments = await (await fetch(`/api/posts/${id}/comments`)).json();
        const updatedPost = await (await fetch(`/api/posts/${id}`)).json();
        renderModal(updatedPost, userStars, updatedComments);
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to comment', 'error');
      }
      commentBtn.disabled = false;
    }
  }
}

// Close modal
modalClose.addEventListener('click', () => modal.classList.add('hidden'));
modal.addEventListener('click', (e) => {
  if (e.target === modal) modal.classList.add('hidden');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') modal.classList.add('hidden');
});

// === DEEP LINKING ===
const urlParams = new URLSearchParams(window.location.search);
const deepLinkPost = urlParams.get('post');

// === INIT ===
loadPosts(true).then(() => {
  if (deepLinkPost) openPost(deepLinkPost);
});
setInterval(() => loadPosts(true), 15000);
