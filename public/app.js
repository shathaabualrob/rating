// Utility: render star display
function renderStars(avg, count) {
  const rounded = Math.round(avg);
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    stars += i <= rounded ? '★' : '☆';
  }
  return `<span class="stars">${stars}</span> <span>${avg.toFixed(1)} (${count} rating${count !== 1 ? 's' : ''})</span>`;
}

// Detect which page we're on
const isPostPage = document.getElementById('post-detail');

if (isPostPage) {
  initPostPage();
} else {
  initHomePage();
}

// === HOME PAGE ===
function initHomePage() {
  const postsContainer = document.getElementById('posts');
  const submitBtn = document.getElementById('submit-btn');
  const titleInput = document.getElementById('title');
  const bodyInput = document.getElementById('body');

  loadPosts();

  submitBtn.addEventListener('click', async () => {
    const title = titleInput.value.trim();
    const body = bodyInput.value.trim();
    if (!title || !body) return;

    submitBtn.disabled = true;
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body })
    });

    if (res.ok) {
      titleInput.value = '';
      bodyInput.value = '';
      loadPosts();
    }
    submitBtn.disabled = false;
  });

  async function loadPosts() {
    const res = await fetch('/api/posts');
    const posts = await res.json();

    if (posts.length === 0) {
      postsContainer.innerHTML = '<p class="empty">No posts yet. Create one above!</p>';
      return;
    }

    postsContainer.innerHTML = posts.map(post => `
      <a href="/post.html?id=${post.id}" class="post-card">
        <h3>${escapeHtml(post.title)}</h3>
        <p class="snippet">${escapeHtml(post.body.slice(0, 120))}${post.body.length > 120 ? '...' : ''}</p>
        <div class="meta">
          <span>${renderStars(post.avg_rating, post.rating_count)}</span>
        </div>
      </a>
    `).join('');
  }
}

// === POST PAGE ===
async function initPostPage() {
  const container = document.getElementById('post-detail');
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    container.innerHTML = '<p>Post not found.</p>';
    return;
  }

  const res = await fetch(`/api/posts/${id}`);
  if (!res.ok) {
    container.innerHTML = '<p>Post not found.</p>';
    return;
  }

  const post = await res.json();

  // Get user's existing rating
  const myRes = await fetch(`/api/posts/${id}/my-rating`);
  const myRating = await myRes.json();

  render(post, myRating.stars);

  function render(post, userStars) {
    container.innerHTML = `
      <h2>${escapeHtml(post.title)}</h2>
      <p class="body">${escapeHtml(post.body)}</p>
      <div class="rating-section">
        <div class="avg-rating">${renderStars(post.avg_rating, post.rating_count)}</div>
        <p><strong>Your rating:</strong></p>
        <div class="stars-interactive" id="star-widget">
          ${[1,2,3,4,5].map(i => `<span class="star ${i <= (userStars || 0) ? 'active' : 'inactive'}" data-star="${i}">★</span>`).join('')}
        </div>
        <p class="your-rating">${userStars ? `You rated this ${userStars} star${userStars !== 1 ? 's' : ''}` : 'Click a star to rate'}</p>
      </div>
    `;

    // Attach star click handlers
    document.querySelectorAll('#star-widget .star').forEach(star => {
      star.addEventListener('click', async () => {
        const stars = parseInt(star.dataset.star);
        const rateRes = await fetch(`/api/posts/${id}/rate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stars })
        });
        if (rateRes.ok) {
          // Reload post data
          const updated = await (await fetch(`/api/posts/${id}`)).json();
          render(updated, stars);
        }
      });
    });
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
