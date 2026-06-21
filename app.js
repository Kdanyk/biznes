// --- Ініціалізація Telegram Web App ---
if (window.Telegram && window.Telegram.WebApp) {
  window.Telegram.WebApp.ready(); 
  window.Telegram.WebApp.expand();
}

// --- Стейт (Стан додатку) ---
let state = {
  folders: JSON.parse(localStorage.getItem('biz_folders')) || [{ id: 'default', name: 'Загальні' }],
  options: JSON.parse(localStorage.getItem('biz_options')) || [],
  activeFolderId: 'default',
  activeTab: 'options',
  editingOptionId: null,
  selectedColor: '#94a3b8' // Дефолтний колір
};

const saveData = () => {
  localStorage.setItem('biz_folders', JSON.stringify(state.folders));
  localStorage.setItem('biz_options', JSON.stringify(state.options));
};

// --- РЕНДЕР ПАПОК ---
const renderFolders = () => {
  const container = document.getElementById('folders-container');
  
  let foldersHTML = state.folders.map(folder => {
    const isActive = folder.id === state.activeFolderId;
    const isDefault = folder.id === 'default';
    const deleteBtnHTML = (isActive && !isDefault) 
      ? `<button class="btn-delete-folder" onclick="deleteFolder('${folder.id}', event)">×</button>` 
      : '';

    return `
      <div class="folder-chip ${isActive ? 'active' : ''}" onclick="selectFolder('${folder.id}')">
        ${folder.name} ${deleteBtnHTML}
      </div>
    `;
  }).join('');

  // Додаємо системну папку Архів
  const isArchiveActive = state.activeFolderId === 'archive';
  foldersHTML += `
    <div class="folder-chip archive ${isArchiveActive ? 'active' : ''}" onclick="selectFolder('archive')">
      📦 Архів
    </div>
    <button class="btn-add-folder" onclick="openFolderModal()">+</button>
  `;

  container.innerHTML = foldersHTML;
};

const selectFolder = (id) => { state.activeFolderId = id; renderFolders(); refreshUI(); };

const deleteFolder = (id, event) => {
  event.stopPropagation();
  if(confirm('Видалити цю папку та всі її варіанти (навіть архівні)?')) {
    state.folders = state.folders.filter(f => f.id !== id);
    state.options = state.options.filter(o => o.folderId !== id);
    state.activeFolderId = 'default';
    saveData(); renderFolders(); refreshUI();
  }
};

// --- СВАЙП ЛОГІКА ---
let touchStartX = 0;
const handleTouchStart = (e) => { touchStartX = e.changedTouches[0].screenX; };
const handleTouchEnd = (id, e) => {
  let touchEndX = e.changedTouches[0].screenX;
  if (touchStartX - touchEndX > 40) { // Свайп вліво на 40px
    toggleDropdown(id, e, true);
  }
};

// --- РЕНДЕР КАРТОК ---
const createCardHTML = (option, index = -1, isRating = false) => {
  let folderBadge = '';
  if ((state.activeFolderId === 'default' || state.activeFolderId === 'archive') && option.folderId !== 'default') {
    const parentFolder = state.folders.find(f => f.id === option.folderId);
    if (parentFolder) folderBadge = `<div class="folder-badge">${parentFolder.name}</div>`;
  }

  const crown = (isRating && index === 0 && option.votes > 0) ? '👑 ' : '';
  const dotColor = option.color || '#94a3b8';
  const archiveBtnText = option.archived ? 'Відновити з архіву' : '📦 В архів';

  return `
    <div class="card" 
         ontouchstart="handleTouchStart(event)" 
         ontouchend="handleTouchEnd('${option.id}', event)">
      <div class="card-content">
        ${folderBadge}
        <div class="card-title">
          <div class="color-dot" style="color: ${dotColor};"></div>
          ${crown}${option.text}
        </div>
      </div>
      <div class="card-actions">
        <span class="badge-count">${option.votes}</span>
        <button class="btn-vote" onclick="vote('${option.id}', event)">+</button>
        <button class="kebab-btn" onclick="toggleDropdown('${option.id}', event)">⋮</button>
      </div>
      
      <div class="dropdown-menu" id="dropdown-${option.id}">
        <button class="dropdown-item" onclick="openOptionModal('${option.id}')">✏️ Редагувати</button>
        <button class="dropdown-item" onclick="toggleArchive('${option.id}')">${archiveBtnText}</button>
        <button class="dropdown-item danger" onclick="deleteOption('${option.id}')">🗑️ Видалити назавжди</button>
      </div>
    </div>
  `;
};

const refreshUI = () => {
  const containerOptions = document.getElementById('tab-options');
  const containerRating = document.getElementById('tab-rating');
  const fab = document.getElementById('fab-add');
  
  let filteredOptions = [];
  if (state.activeFolderId === 'archive') {
    filteredOptions = state.options.filter(opt => opt.archived);
    fab.style.display = 'none';
  } else if (state.activeFolderId === 'default') {
    filteredOptions = state.options.filter(opt => !opt.archived);
    fab.style.display = 'none';
  } else {
    filteredOptions = state.options.filter(opt => opt.folderId === state.activeFolderId && !opt.archived);
    fab.style.display = 'flex';
  }

  if (filteredOptions.length === 0) {
    const emptyMsg = '<div class="empty-state">Тут поки порожньо.</div>';
    containerOptions.innerHTML = emptyMsg; containerRating.innerHTML = emptyMsg; return;
  }

  const sortedByTime = [...filteredOptions].sort((a, b) => b.createdAt - a.createdAt);
  containerOptions.innerHTML = sortedByTime.map(opt => createCardHTML(opt)).join('');

  const sortedByVotes = [...filteredOptions].sort((a, b) => b.votes !== a.votes ? b.votes - a.votes : a.createdAt - b.createdAt);
  containerRating.innerHTML = sortedByVotes.map((opt, i) => createCardHTML(opt, i, true)).join('');
};

// --- ЛОГІКА ДІЙ ---
const vote = (id, event) => {
  const opt = state.options.find(o => o.id === id);
  if (opt) { 
    opt.votes++; 
    saveData(); 
    
    const floatEl = document.createElement('div');
    floatEl.className = 'float-plus';
    floatEl.innerText = '+1';
    floatEl.style.left = `${event.clientX - 10}px`;
    floatEl.style.top = `${event.clientY - 20}px`;
    document.body.appendChild(floatEl);
    setTimeout(() => floatEl.remove(), 800);

    refreshUI(); 
  }
};

const toggleArchive = (id) => {
  const opt = state.options.find(o => o.id === id);
  if(opt) { opt.archived = !opt.archived; saveData(); refreshUI(); }
};

const deleteOption = (id) => {
  if(confirm('Видалити назавжди?')) {
    state.options = state.options.filter(o => o.id !== id);
    saveData(); refreshUI();
  }
};

// Меню з виправленням перекриття (z-index)
const toggleDropdown = (id, event, forceOpen = false) => {
  if(event) event.stopPropagation();
  
  const menu = document.getElementById(`dropdown-${id}`);
  const card = menu.closest('.card');
  const isActive = menu.classList.contains('active');

  document.querySelectorAll('.dropdown-menu').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.card').forEach(el => el.style.zIndex = '1');

  if (forceOpen || !isActive) {
    menu.classList.add('active');
    if (card) card.style.zIndex = '50';
  }
};

document.addEventListener('click', () => {
  document.querySelectorAll('.dropdown-menu').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.card').forEach(el => el.style.zIndex = '1');
});

// --- КОЛЬОРИ ---
const selectColor = (element) => {
  document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
  element.classList.add('selected');
  state.selectedColor = element.getAttribute('data-color');
};

// --- МОДАЛЬНІ ВІКНА ---
const openOptionModal = (editId = null) => {
  if (!editId && (state.activeFolderId === 'default' || state.activeFolderId === 'archive')) return;

  state.editingOptionId = editId;
  const input = document.getElementById('input-option');
  const title = document.getElementById('modal-option-title');
  
  if (editId) {
    const opt = state.options.find(o => o.id === editId);
    input.value = opt.text;
    title.innerText = 'Редагувати варіант';
    const targetColor = opt.color || '#94a3b8';
    const colorOpt = document.querySelector(`.color-option[data-color="${targetColor}"]`);
    if(colorOpt) selectColor(colorOpt);
  } else {
    input.value = '';
    title.innerText = 'Новий варіант';
    selectColor(document.querySelector('.color-option[data-color="#94a3b8"]'));
  }
  
  document.getElementById('modal-option').classList.add('active');
  setTimeout(() => input.focus(), 100);
};

const saveOption = () => {
  const text = document.getElementById('input-option').value.trim();
  if (!text) return;

  if (state.editingOptionId) {
    const opt = state.options.find(o => o.id === state.editingOptionId);
    if (opt) {
      opt.text = text;
      opt.color = state.selectedColor;
    }
  } else {
    state.options.push({
      id: Date.now().toString(),
      folderId: state.activeFolderId,
      text: text,
      votes: 0,
      color: state.selectedColor,
      archived: false,
      createdAt: Date.now()
    });
  }

  saveData(); closeModal('modal-option'); refreshUI();
};

const openFolderModal = () => {
  document.getElementById('input-folder').value = '';
  document.getElementById('modal-folder').classList.add('active');
  setTimeout(() => document.getElementById('input-folder').focus(), 100);
};

const saveFolder = () => {
  const name = document.getElementById('input-folder').value.trim();
  if (!name) return;
  const newFolder = { id: 'f_' + Date.now(), name: name };
  state.folders.push(newFolder); state.activeFolderId = newFolder.id; 
  saveData(); closeModal('modal-folder'); renderFolders(); refreshUI();
};

const closeModal = (modalId) => { document.getElementById(modalId).classList.remove('active'); };

// --- НАВІГАЦІЯ ---
const switchTab = (tabName) => {
  state.activeTab = tabName;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById(`nav-${tabName}`).classList.add('active');
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab-${tabName}`).classList.add('active');
};

// --- Ініціалізація ---
renderFolders(); 
refreshUI();
