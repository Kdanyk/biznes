if (window.Telegram && window.Telegram.WebApp) {
  window.Telegram.WebApp.ready(); 
  window.Telegram.WebApp.expand();
}

// Твій ключ API
const AI_API_KEY = 'AQ.Ab8RN6LJgHRHRsjbExLQOe7EctbPVK7CYFpYnIJJEHPsN2xeSg'; 
// Виправлені лапки на зворотні (бектики ` `)
const AI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${AQ.Ab8RN6LJgHRHRsjbExLQOe7EctbPVK7CYFpYnIJJEHPsN2xeSg}`;

let state = {
  folders: JSON.parse(localStorage.getItem('biz_folders')) || [{ id: 'default', name: 'Загальні' }],
  options: JSON.parse(localStorage.getItem('biz_options')) || [],
  activeFolderId: 'default',
  activeTab: 'options',
  editingOptionId: null,
  selectedColor: '#94a3b8',
  rates: { EUR: 1, PLN: 4.3 }
};

let chartInstance = null;

const saveData = () => {
  localStorage.setItem('biz_folders', JSON.stringify(state.folders));
  localStorage.setItem('biz_options', JSON.stringify(state.options));
};

// --- API КУРСІВ ВАЛЮТ ---
const fetchExchangeRates = async () => {
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
    const data = await res.json();
    state.rates.PLN = data.rates.PLN;
    const banner = document.getElementById('exchange-rate-banner');
    if(banner) banner.innerText = `💶 1 EUR = 🇵🇱 ${state.rates.PLN.toFixed(2)} PLN`;
  } catch (e) {
    console.error("Помилка курсу валют", e);
  }
};

// --- РОБОТА З AI (Правильний код для Google Gemini) ---
const analyzeIdeaWithAI = async (id, event) => {
  if(event) event.stopPropagation();
  
  const option = state.options.find(o => o.id === id);
  if (!option) return;

  const btn = document.getElementById(`ai-btn-${id}`);
  btn.classList.add('ai-loading');
  btn.innerText = '⏳ Аналізую...';

  const prompt = `Проаналізуй бізнес ідею: "${option.text}". 
  Контекст: Ринок Європи/Польщі (використовуй PLN або EUR).
  Поверни СУВОРО JSON об'єкт (без маркдауну) з такими полями:
  "startupCost" (число), "monthlyCost" (число), "currency" (рядок "PLN" або "EUR"), 
  "roiMonths" (окупність в місяцях, число), "risk" (оцінка ризику 1-10, число), 
  "profitability" (оцінка прибутку 1-10, число), "timeToLaunch" (рядок, напр. "3 місяці"),
  "summary" (короткий висновок, 2-3 речення).`;

  try {
    const response = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      // Правильне тіло запиту для Gemini
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const data = await response.json();
    
    // Перевірка на помилки ключа або лімітів
    if (data.error) {
      throw new Error(data.error.message);
    }

    // Правильний парсинг відповіді Gemini
    const jsonStr = data.candidates[0].content.parts[0].text;
    option.aiData = JSON.parse(jsonStr);
    saveData();
  } catch (error) {
    alert(`Помилка AI: ${error.message}. Перевір консоль або правильність API ключа.`);
    console.error(error);
  } finally {
    refreshUI();
  }
};

const showAIReport = (id) => {
  const option = state.options.find(o => o.id === id);
  if (!option || !option.aiData) return;
  
  const ai = option.aiData;
  const content = document.getElementById('ai-report-content');
  
  content.innerHTML = `
    <h4 style="margin-bottom: 16px; color: ${option.color || '#fff'}">${option.text}</h4>
    <div class="report-grid">
      <div class="report-stat">
        <span class="report-label">Старт. капітал</span>
        <span class="report-value">${ai.startupCost.toLocaleString()} ${ai.currency}</span>
      </div>
      <div class="report-stat">
        <span class="report-label">Операційні (міс.)</span>
        <span class="report-value">${ai.monthlyCost.toLocaleString()} ${ai.currency}</span>
      </div>
      <div class="report-stat">
        <span class="report-label">Окупність (ROI)</span>
        <span class="report-value">~${ai.roiMonths} міс.</span>
      </div>
      <div class="report-stat">
        <span class="report-label">Час на запуск</span>
        <span class="report-value">${ai.timeToLaunch}</span>
      </div>
      <div class="report-stat">
        <span class="report-label">Ризик (1-10)</span>
        <span class="report-value">⚠️ ${ai.risk}/10</span>
      </div>
      <div class="report-stat">
        <span class="report-label">Потенціал (1-10)</span>
        <span class="report-value">🚀 ${ai.profitability}/10</span>
      </div>
    </div>
    <div class="report-text">${ai.summary}</div>
  `;
  
  document.getElementById('modal-ai-report').classList.add('active');
};

const renderChart = () => {
  const canvas = document.getElementById('riskMatrixChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  const analyzedOptions = state.options.filter(o => o.aiData);
  const chartData = {
    datasets: analyzedOptions.map(opt => ({
      label: opt.text,
      data: [{ x: opt.aiData.risk, y: opt.aiData.profitability }],
      backgroundColor: opt.color || '#3B82F6',
      pointRadius: 8,
      pointHoverRadius: 12
    }))
  };

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: 'scatter',
    data: chartData,
    options: {
      responsive: true,
      scales: {
        x: { title: { display: true, text: 'Рівень Ризику (1-10)', color: '#94a3b8' }, min: 0, max: 10, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
        y: { title: { display: true, text: 'Прибутковість (1-10)', color: '#94a3b8' }, min: 0, max: 10, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: Ризик ${ctx.raw.x}, Прибуток ${ctx.raw.y}` } }
      }
    }
  });
};

const createCardHTML = (option, index = -1, isRating = false) => {
  let folderBadge = '';
  if ((state.activeFolderId === 'default' || state.activeFolderId === 'archive') && option.folderId !== 'default') {
    const parentFolder = state.folders.find(f => f.id === option.folderId);
    if (parentFolder) folderBadge = `<div class="folder-badge">${parentFolder.name}</div>`;
  }

  const dotColor = option.color || '#94a3b8';
  let aiButton = option.aiData 
    ? `<button class="ai-badge" onclick="showAIReport('${option.id}')">📊 Дивитись звіт</button>` 
    : `<button class="ai-badge" id="ai-btn-${option.id}" style="background: rgba(255,255,255,0.1); color: #94a3b8;" onclick="analyzeIdeaWithAI('${option.id}', event)">✨ Аналіз AI</button>`;

  return `
    <div class="card">
      <div class="card-content">
        ${folderBadge}
        <div class="card-title">
          <div class="color-dot" style="color: ${dotColor};"></div>
          ${option.text}
        </div>
        ${aiButton}
      </div>
      <div class="card-actions">
        <span class="badge-count">${option.votes}</span>
        <button class="btn-vote" onclick="vote('${option.id}', event)">+</button>
        <button class="kebab-btn" onclick="toggleDropdown('${option.id}', event)">⋮</button>
      </div>
      
      <div class="dropdown-menu" id="dropdown-${option.id}">
        <button class="dropdown-item" onclick="openOptionModal('${option.id}')">✏️ Редагувати</button>
        <button class="dropdown-item danger" onclick="deleteOption('${option.id}')">🗑️ Видалити</button>
      </div>
    </div>
  `;
};

const refreshUI = () => {
  const containerOptions = document.getElementById('tab-options');
  const containerRating = document.getElementById('tab-rating');
  const fab = document.getElementById('fab-add');
  
  if (!containerOptions || !containerRating) return;

  let filteredOptions = state.activeFolderId === 'default' 
    ? state.options 
    : state.options.filter(opt => opt.folderId === state.activeFolderId);

  if(fab) fab.style.display = state.activeFolderId === 'default' ? 'none' : 'flex';

  if (filteredOptions.length === 0) {
    containerOptions.innerHTML = '<div class="empty-state">Тут поки порожньо.</div>';
    containerRating.innerHTML = '<div class="empty-state">Тут поки порожньо.</div>';
  } else {
    containerOptions.innerHTML = [...filteredOptions].sort((a, b) => b.createdAt - a.createdAt).map(opt => createCardHTML(opt)).join('');
    containerRating.innerHTML = [...filteredOptions].sort((a, b) => b.votes !== a.votes ? b.votes - a.votes : a.createdAt - b.createdAt).map((opt, i) => createCardHTML(opt, i, true)).join('');
  }

  if (state.activeTab === 'analytics') renderChart();
};

const switchTab = (tabName) => {
  state.activeTab = tabName;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const activeNav = document.getElementById(`nav-${tabName}`);
  if(activeNav) activeNav.classList.add('active');
  
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  const activeTab = document.getElementById(`tab-${tabName}`);
  if(activeTab) activeTab.classList.add('active');

  if (tabName === 'analytics') {
    renderChart();
  }
};

const toggleDropdown = (id, event) => {
  if(event) event.stopPropagation();
  const menu = document.getElementById(`dropdown-${id}`);
  const card = menu.closest('.card');
  const isActive = menu.classList.contains('active');
  document.querySelectorAll('.dropdown-menu').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.card').forEach(el => el.style.zIndex = '1');
  if (!isActive) { menu.classList.add('active'); if(card) card.style.zIndex = '50'; }
};

document.addEventListener('click', () => {
  document.querySelectorAll('.dropdown-menu').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.card').forEach(el => el.style.zIndex = '1');
});

const renderFolders = () => {
  const container = document.getElementById('folders-container');
  if(!container) return;
  let foldersHTML = state.folders.map(folder => {
    const isActive = folder.id === state.activeFolderId;
    const deleteBtnHTML = (isActive && folder.id !== 'default') ? `<button class="btn-delete-folder" onclick="deleteFolder('${folder.id}', event)">×</button>` : '';
    return `<div class="folder-chip ${isActive ? 'active' : ''}" onclick="selectFolder('${folder.id}')">${folder.name} ${deleteBtnHTML}</div>`;
  }).join('');
  
  foldersHTML += `<button class="btn-add-folder" onclick="openFolderModal()">+</button>`;
  container.innerHTML = foldersHTML;
};

const selectFolder = (id) => { state.activeFolderId = id; renderFolders(); refreshUI(); };
const deleteFolder = (id, event) => { event.stopPropagation(); if(confirm('Видалити цю папку?')) { state.folders = state.folders.filter(f => f.id !== id); state.options = state.options.filter(o => o.folderId !== id); state.activeFolderId = 'default'; saveData(); renderFolders(); refreshUI(); } };
const vote = (id, event) => { const opt = state.options.find(o => o.id === id); if (opt) { opt.votes++; saveData(); refreshUI(); } };
const deleteOption = (id) => { if(confirm('Видалити?')) { state.options = state.options.filter(o => o.id !== id); saveData(); refreshUI(); } };
const selectColor = (el) => { document.querySelectorAll('.color-option').forEach(e => e.classList.remove('selected')); el.classList.add('selected'); state.selectedColor = el.getAttribute('data-color'); };
const openOptionModal = (editId = null) => { state.editingOptionId = editId; const input = document.getElementById('input-option'); if (editId) { const opt = state.options.find(o => o.id === editId); input.value = opt.text; const colorOpt = document.querySelector(`.color-option[data-color="${opt.color || '#94a3b8'}"]`); if(colorOpt) selectColor(colorOpt); } else { input.value = ''; selectColor(document.querySelector('.color-option[data-color="#94a3b8"]')); } document.getElementById('modal-option').classList.add('active'); setTimeout(() => input.focus(), 100); };
const saveOption = () => { const text = document.getElementById('input-option').value.trim(); if (!text) return; if (state.editingOptionId) { const opt = state.options.find(o => o.id === state.editingOptionId); if (opt) { opt.text = text; opt.color = state.selectedColor; } } else { state.options.push({ id: Date.now().toString(), folderId: state.activeFolderId, text, votes: 0, color: state.selectedColor, createdAt: Date.now() }); } saveData(); closeModal('modal-option'); refreshUI(); };
const openFolderModal = () => { document.getElementById('input-folder').value = ''; document.getElementById('modal-folder').classList.add('active'); setTimeout(() => document.getElementById('input-folder').focus(), 100); };
const saveFolder = () => { const name = document.getElementById('input-folder').value.trim(); if (!name) return; const newFolder = { id: 'f_' + Date.now(), name }; state.folders.push(newFolder); state.activeFolderId = newFolder.id; saveData(); closeModal('modal-folder'); renderFolders(); refreshUI(); };
const closeModal = (id) => { document.getElementById(id).classList.remove('active'); };

// Запуск
fetchExchangeRates();
renderFolders(); 
refreshUI();
