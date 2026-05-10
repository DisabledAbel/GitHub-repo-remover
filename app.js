const API_BASE = 'https://api.github.com';
const TRASH_KEY = 'repo-remover-trash-v1';
const RESTORE_DAYS = 90;

let repos = [];

const elements = {
  token: document.getElementById('token'),
  toggleToken: document.getElementById('toggle-token'),
  loadRepos: document.getElementById('load-repos'),
  filterName: document.getElementById('filter-name'),
  filterVisibility: document.getElementById('filter-visibility'),
  sortBy: document.getElementById('sort-by'),
  repoBody: document.getElementById('repo-body'),
  trashBody: document.getElementById('trash-body'),
  status: document.getElementById('status')
};

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.style.color = isError ? 'var(--danger)' : 'var(--subtext)';
}

function getToken() {
  return elements.token.value.trim();
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

async function fetchAllRepos(token) {
  const output = [];
  let page = 1;

  while (page <= 10) {
    const res = await fetch(`${API_BASE}/user/repos?per_page=100&type=owner&sort=updated&page=${page}`, {
      headers: authHeaders(token)
    });

    if (!res.ok) {
      let text = 'Unknown error';
      try {
        const errorBody = await res.text();
        text = errorBody || `HTTP error ${res.status}`;
      } catch {
        text = `HTTP error ${res.status}`;
      }
      throw new Error(text);
    }

    const batch = await res.json();
    output.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }

  return output;
}

function loadTrash() {
  try {
    const data = JSON.parse(localStorage.getItem(TRASH_KEY) || '[]');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveTrash(items) {
  localStorage.setItem(TRASH_KEY, JSON.stringify(items));
}

function addToTrash(repo) {
  const now = Date.now();
  const expiresAt = now + RESTORE_DAYS * 24 * 60 * 60 * 1000;
  const trash = loadTrash();

  const newItem = {
    id: repo.id,
    name: repo.name,
    owner: repo.owner.login,
    full_name: repo.full_name,
    visibility: repo.private ? 'private' : 'public',
    deletedAt: now,
    expiresAt,
    restored: false
  };

  const deduped = trash.filter((item) => item.id !== repo.id);
  deduped.unshift(newItem);
  saveTrash(deduped);
  renderTrash();
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function getFilteredRepos() {
  const nameFilter = elements.filterName.value.trim().toLowerCase();
  const vis = elements.filterVisibility.value;
  const sortBy = elements.sortBy.value;

  const filtered = repos.filter((repo) => {
    const nameMatch = !nameFilter || repo.name.toLowerCase().includes(nameFilter);
    const visMatch = vis === 'all' || (vis === 'public' && !repo.private) || (vis === 'private' && repo.private);
    return nameMatch && visMatch;
  });

  return filtered.sort((a, b) => {
    if (sortBy === 'stars') {
      return b.stargazers_count - a.stargazers_count || new Date(b.updated_at) - new Date(a.updated_at);
    }

    if (sortBy === 'archived') {
      return Number(b.archived) - Number(a.archived) || new Date(b.updated_at) - new Date(a.updated_at);
    }

    return new Date(b.updated_at) - new Date(a.updated_at);
  });
}

function renderRepos() {
  const list = getFilteredRepos();

  if (!list.length) {
    elements.repoBody.innerHTML = '<tr><td colspan="7" class="empty">No repositories match this filter.</td></tr>';
    return;
  }

  elements.repoBody.innerHTML = list
    .map(
      (repo) => `
      <tr>
        <td>${repo.name}</td>
        <td>${repo.owner.login}</td>
        <td>${repo.private ? 'Private' : 'Public'}</td>
        <td>${repo.archived ? 'Yes' : 'No'}</td>
        <td>${repo.stargazers_count}</td>
        <td>${new Date(repo.updated_at).toLocaleString()}</td>
        <td><button class="delete" data-delete-id="${repo.id}">Delete</button></td>
      </tr>
    `
    )
    .join('');
}

function renderTrash() {
  const now = Date.now();
  const trash = loadTrash();

  if (!trash.length) {
    elements.trashBody.innerHTML = '<tr><td colspan="4" class="empty">No deleted repositories tracked yet.</td></tr>';
    return;
  }

  elements.trashBody.innerHTML = trash
    .map((item) => {
      const expired = now > item.expiresAt;
      const statusText = item.restored ? 'Restored' : expired ? 'Expired' : 'Available';
      const disabled = item.restored || expired;
      return `
        <tr>
          <td>
            ${item.full_name}
            <div class="small">${item.visibility}</div>
          </td>
          <td>${formatDate(item.deletedAt)}</td>
          <td>${formatDate(item.expiresAt)}<div class="small">${statusText}</div></td>
          <td>
            <button class="restore" data-restore-id="${item.id}" ${disabled ? 'disabled' : ''}>Restore</button>
          </td>
        </tr>
      `;
    })
    .join('');
}

async function deleteRepoById(repoId) {
  const token = getToken();
  if (!token) {
    setStatus('Enter a PAT before deleting.', true);
    return;
  }

  const repo = repos.find((r) => r.id === Number(repoId));
  if (!repo) {
    setStatus('Repository not found in loaded list.', true);
    return;
  }

  const ok = window.confirm(`Delete ${repo.full_name}? This is destructive.`);
  if (!ok) return;

  setStatus(`Deleting ${repo.full_name}...`);

  const res = await fetch(`${API_BASE}/repos/${repo.owner.login}/${repo.name}`, {
    method: 'DELETE',
    headers: authHeaders(token)
  });

  if (res.status !== 204) {
    let text = 'Unknown error';
    try {
      const errorBody = await res.text();
      text = errorBody || `HTTP error ${res.status}`;
    } catch {
      text = `HTTP error ${res.status}`;
    }
    throw new Error(`Delete failed: ${text}`);
  }

  addToTrash(repo);
  repos = repos.filter((r) => r.id !== repo.id);
  renderRepos();
  setStatus(`Deleted ${repo.full_name}. Added to 90-day restore queue.`);
}

async function restoreRepo(itemId) {
  const token = getToken();
  if (!token) {
    setStatus('Enter a PAT before restoring.', true);
    return;
  }

  const trash = loadTrash();
  const item = trash.find((i) => i.id === Number(itemId));
  if (!item) {
    setStatus('Item not found in trash queue.', true);
    return;
  }

  const now = Date.now();
  if (item.restored || now > item.expiresAt) {
    setStatus('Restore window expired or item already restored.', true);
    return;
  }

  setStatus(`Attempting restore for ${item.full_name}...`);

  const res = await fetch(`${API_BASE}/repos/${item.owner}/${item.name}/restore`, {
    method: 'POST',
    headers: authHeaders(token)
  });

  // GitHub restore API returns 201 Created on successful restore
  if (res.status === 201 || res.status === 202) {
    item.restored = true;
    saveTrash(trash);
    renderTrash();
    setStatus(`Restore requested for ${item.full_name}.`);
    return;
  }

  const fallbackUrl = `https://github.com/settings/repositories`;
  const text = await res.text().catch(() => '');
  setStatus(
    `Automatic restore failed (HTTP ${res.status}): ${text || 'Unknown error'}. Use GitHub Deleted Repositories UI: ${fallbackUrl}`,
    true
  );
}

function handleTableClick(event) {
  const deleteButton = event.target.closest('button[data-delete-id]');
  if (deleteButton) {
    deleteRepoById(deleteButton.dataset.deleteId).catch((error) => setStatus(error.message, true));
    return;
  }

  const restoreButton = event.target.closest('button[data-restore-id]');
  if (restoreButton) {
    restoreRepo(restoreButton.dataset.restoreId).catch((error) => setStatus(error.message, true));
  }
}

async function loadRepos() {
  const token = getToken();
  if (!token) {
    setStatus('Enter a PAT to load repositories.', true);
    return;
  }

  setStatus('Loading repositories...');
  repos = await fetchAllRepos(token);
  renderRepos();
  setStatus(`Loaded ${repos.length} repositories.`);
}

elements.toggleToken.addEventListener('click', () => {
  const current = elements.token.getAttribute('type');
  const next = current === 'password' ? 'text' : 'password';
  elements.token.setAttribute('type', next);
  elements.toggleToken.textContent = next === 'password' ? 'Show' : 'Hide';
});

elements.loadRepos.addEventListener('click', () => {
  loadRepos().catch((error) => setStatus(error.message, true));
});

elements.filterName.addEventListener('input', renderRepos);
elements.filterVisibility.addEventListener('change', renderRepos);
elements.sortBy.addEventListener('change', renderRepos);
elements.repoBody.addEventListener('click', handleTableClick);
elements.trashBody.addEventListener('click', handleTableClick);

renderTrash();
