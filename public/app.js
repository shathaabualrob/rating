const GIPHY_API_KEY = '9ZRvg8F4KyslwEtn46ZgtN4sHvjlVwmM';

// Utility: render star display
function renderStars(avg, count) {
  const rounded = Math.round(avg);
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    stars += i <= rounded ? '★' : '☆';
  }
  return `<span class="stars">${stars}</span> <span>${avg.toFixed(1)} (${count} rating${count !== 1 ? 's' : ''})</span>`;
}

// === MAIN ===
const postsContainer = document.getElementById('posts');
const submitBtn = document.getElementById('submit-btn');
const titleInput = document.getElementById('title');
const bodyInput = document.getElementById('body');
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

let selectedGif = null;
let searchTimeout = null;

// Show selected file name & clear gif selection
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

// Toggle GIF picker
gifBtn.addEventListener('click', () => {
  gifPicker.classList.toggle('hidden');
  if (!gifPicker.classList.contains('hidden')) {
    gifSearch.focus();
    loadTrendingGifs();
  }
});

// GIF search with debounce
gifSearch.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const query = gifSearch.value.trim();
    if (query) {
      searchGifs(query);
    } else {
      loadTrendingGifs();
    }
  }, 400);
});

async function loadTrendingGifs() {
  try {
    const res = await fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=18&rating=g`);
    const data = await res.json();
    renderGifs(data.data);
  } catch (e) {
    gifResults.innerHTML = '<p style="color:#999;font-size:0.8rem;">Could not load GIFs</p>';
  }
}

async function searchGifs(query) {
  try {
    const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=18&rating=g`);
    const data = await res.json();
    renderGifs(data.data);
  } catch (e) {
    gifResults.innerHTML = '<p style="color:#999;font-size:0.8rem;">Search failed</p>';
  }
}

function renderGifs(gifs) {
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

// Submit post
submitBtn.addEventListener('click', async () => {
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  if (!title || !body) return;

  submitBtn.disabled = true;

  const formData = new FormData();
  formData.append('title', title);
  formData.append('body', body);

  if (imageInput.files.length) {
    formData.append('image', imageInput.files[0]);
  } else if (selectedGif) {
    formData.append('gif_url', selectedGif);
  }

  const res = await fetch('/api/posts', {
    method: 'POST',
    body: formData
  });

  if (res.ok) {
    titleInput.value = '';
    bodyInput.value = '';
    imageInput.value = '';
    fileName.textContent = 'Attach image (optional)';
    fileName.classList.remove('has-file');
    selectedGif = null;
    gifUrlInput.value = '';
    gifPicker.classList.add('hidden');
    gifSearch.value = '';
    gifResults.innerHTML = '';
    loadPosts();
  }
  submitBtn.disabled = false;
});

// Load and render posts
async function loadPosts() {
  const res = await fetch('/api/posts');
  const posts = await res.json();

  if (posts.length === 0) {
    postsContainer.innerHTML = '<p class="empty">No posts yet. Create one above!</p>';
    return;
  }

  postsContainer.innerHTML = posts.map(post => `
    <div class="post-card" data-id="${post.id}">
      <h3>${escapeHtml(post.title)}</h3>
      <p class="snippet">${escapeHtml(post.body.slice(0, 120))}${post.body.length > 120 ? '...' : ''}</p>
      ${post.image ? `<img src="${post.image}" alt="post image">` : ''}
      <div class="meta">
        <span>${renderStars(post.avg_rating, post.rating_count)}</span>
      </div>
    </div>
  `).join('');

  // Attach click to open modal
  postsContainer.querySelectorAll('.post-card').forEach(card => {
    card.addEventListener('click', () => openPost(card.dataset.id));
  });
}

// Open post in modal
async function openPost(id) {
  const res = await fetch(`/api/posts/${id}`);
  if (!res.ok) return;
  const post = await res.json();

  const myRes = await fetch(`/api/posts/${id}/my-rating`);
  const myRating = await myRes.json();

  renderModal(post, myRating.stars);
  modal.classList.remove('hidden');

  function renderModal(post, userStars) {
    modalBody.innerHTML = `
      <h2>${escapeHtml(post.title)}</h2>
      <p class="body">${escapeHtml(post.body)}</p>
      ${post.image ? `<img src="${post.image}" alt="post image">` : ''}
      <div class="rating-section">
        <div class="avg-rating">${renderStars(post.avg_rating, post.rating_count)}</div>
        <p><strong>Your rating:</strong></p>
        <div class="stars-interactive" id="star-widget">
          ${[1,2,3,4,5].map(i => `<span class="star ${i <= (userStars || 0) ? 'active' : 'inactive'}" data-star="${i}">★</span>`).join('')}
        </div>
        <p class="your-rating">${userStars ? `You rated this ${userStars} star${userStars !== 1 ? 's' : ''}` : 'Click a star to rate'}</p>
      </div>
    `;

    document.querySelectorAll('#star-widget .star').forEach(star => {
      star.addEventListener('click', async () => {
        const stars = parseInt(star.dataset.star);
        const rateRes = await fetch(`/api/posts/${id}/rate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stars })
        });
        if (rateRes.ok) {
          const updated = await (await fetch(`/api/posts/${id}`)).json();
          renderModal(updated, stars);
          loadPosts(); // refresh cards behind modal
        }
      });
    });
  }
}

// Close modal
modalClose.addEventListener('click', () => modal.classList.add('hidden'));
modal.addEventListener('click', (e) => {
  if (e.target === modal) modal.classList.add('hidden');
});

// Initial load + auto-refresh
loadPosts();
setInterval(loadPosts, 10000);

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
