if (window.Telegram && window.Telegram.WebApp) {
  window.Telegram.WebApp.ready(); 
  window.Telegram.WebApp.expand();
}

// ⚠️ УВАГА: В реальному продакшені API ключі НЕ зберігаються на фронтенді! 
// Але для особистого PWA додатку в Telegram це припустимо для тестування.
const AI_API_KEY = ''; // Встав сюди свій ключ (наприклад, OpenAI)
const AI_API_URL = 'https://api.openai.com/v1/chat/completions';

let state = {
  folders: JSON.parse(localStorage.getItem('biz_folders')) || [{ id: 'default', name: 'Загальні' }],
  options: JSON.parse(localStorage.getItem('biz_options')) || [],
  activeFolderId: 'default',
  activeTab: 'options',
  editingOptionId: null,
  selectedColor: '#94a3b8',
  rates: { EUR: 1, PLN: 4.3 } // Заглушка, оновиться через API
};

let chartInstance = null; // Змінна для зберігання графіка

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
    document.getElementById('exchange-rate-banner').innerText = `💶 1 EUR = 🇵🇱 ${state.rates.PLN.toFixed(2)} PLN`;
  } catch (e) {
    console.error("Помилка курсу валют", e);
  }
};

// --- РОБОТА З AI ---
const analyzeIdeaWithAI = async (id, event) => {
  if(event) event.stopPropagation();
  
  const option = state.options.find(o => o.id === id);
  if (!option) return;

  // Візуалізація загрузки
  const btn = document.getElementById(`ai-btn-${id}`);
  btn.classList.add('ai-loading');
  btn.innerText = '⏳ Аналізую...';

  // Якщо ключа немає, генеруємо фейковий (але реалістичний) аналіз для тесту
  if (!AI_API_KEY) {
    setTimeout(() => {
      option.aiData = {
        startupCost: Math.floor(Math.random() * 50000) + 10000,
        monthlyCost: Math.floor(Math.random() * 10000) + 2000,
        currency: Math.random() > 0.5 ? 'EUR' : 'PLN',
        roiMonths: Math.floor(Math.random() * 24) + 6,
        risk: Math.floor(Math.random() * 10) + 1,
        profitability: Math.floor(Math.random() * 10) + 1,
        timeToLaunch: "2-4 місяці",
        summary: "Автоматичний аналіз (Без API ключа). Для запуску потрібен лізинг, сертифікати та первинний капітал."
      };
      saveData();
      refreshUI();
    }, 2000);
    return;
  }

  // РЕАЛЬНИЙ ЗАПИТ ДО AI (OpenAI API формат)
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
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7
      })
    });

    const data = await response.json();
    const jsonStr = data.choices[0].message.content;
    option.aiData = JSON.parse(jsonStr); // Зберігаємо аналіз
    saveData();
  } catch (error) {
    alert('Помилка звернення до AI. Перевір консоль.');
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

// --- ГРАФІК (CHART.JS) ---
const renderChart = () => {
  const canvas = document.getElementById('riskMatrixChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  
  // Беремо лише ідеї, які вже проаналізовані AI
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
        x: { 
          title: { display: true, text: 'Рівень Ризику (1-10)', color: '#94a3b8' },
          min: 0, max: 10,
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#94a3b8' }
        },
        y: { 
          title: { display: true, text: 'Прибутковість (1-10)', color: '#94a3b8' },
          min: 0, max: 10,
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#94a3b8' }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: Ризик ${ctx.raw.x}, Прибуток ${ctx.raw.y}`
          }
        }
      }
    }
  });
};

// --- РЕНДЕР КАРТОК (Оновлено) ---
const createCardHTML = (option, index = -1, isRating = false) => {
  let folderBadge = '';
  if ((state.activeFolderId === 'default' || state.activeFolderId === 'archive') && option.folderId !== 'default') {
    const parentFolder = state.folders.find(f => f.id === option.folderId);
    if (parentFolder) folderBadge = `<div class="folder-badge">${parentFolder.name}</div>`;
  }

  const dotColor = option.color || '#94a3b8';
  
  // Кнопка AI або перегляд звіту
  let aiButton = '';
  if (option.aiData) {
    aiButton = `<button class="ai-badge" onclick="showAIReport('${option.id}')">📊 Дивитись звіт</button>`;
  } else {
    aiButton = `<button class="ai-badge" id="ai-btn-${option.id}" style="background: rgba(255,255,255,0.1); color: #94a3b8;" onclick="analyzeIdeaWithAI('${option.id}', event)">✨ Аналіз AI</button>`;
  }

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

// (Інші функції: renderFolders, vote, deleteOption, refreshUI залишаються без змін, 
// але в кінці refreshUI() додай виклик renderChart())

const refreshUI = () => {
  // ... (весь старий код refreshUI)
  const containerOptions = document.getElementById('tab-options');
  const containerRating = document.getElementById('tab-rating');
  const fab = document.getElementById('fab-add');
  
  let filteredOptions = state.activeFolderId === 'default' 
    ? state.options 
    : state.options.filter(opt => opt.folderId === state.activeFolderId);

  fab.style.display = state.activeFolderId === 'default' ? 'none' : 'flex';

  if (filteredOptions.length === 0) {
    containerOptions.innerHTML = '<div class="empty-state">Тут поки порожньо.</div>';
    containerRating.innerHTML = '<div class="empty-state">Тут поки порожньо.</div>';
  } else {
    containerOptions.innerHTML = [...filteredOptions].sort((a, b) => b.createdAt - a.createdAt).map(opt => createCardHTML(opt)).join('');
    containerRating.innerHTML = [...filteredOptions].sort((a, b) => b.votes !== a.votes ? b.votes - a.votes : a.createdAt - b.createdAt).map((opt, i) => createCardHTML(opt, i, true)).join('');
  }

  // Оновлюємо графіки
  if (state.activeTab === 'analytics') renderChart();
};

// --- НАВІГАЦІЯ ТА ІНІЦІАЛІЗАЦІЯ ---
const switchTab = (tabName) => {
  state.activeTab = tabName;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById(`nav-${tabName}`).classList.add('active');
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab-${tabName}`).classList.add('active');

  if (tabName === 'analytics') {
    renderChart();
  }
};

// Базові функції UI
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
const vote = (id, event) => { const opt = state.options.find(o => o.id === id); if (opt) { opt.votes++; saveData(); refreshUI(); } };
const deleteOption = (id) => { if(confirm('Видалити?')) { state.options = state.options.filter(o => o.id !== id); saveData(); refreshUI(); } };
const selectColor = (el) => { document.querySelectorAll('.color-option').forEach(e => e.classList.remove('selected')); el.classList.add('selected'); state.selectedColor = el.getAttribute('data-color'); };
const openOptionModal = () => { document.getElementById('input-option').value = ''; selectColor(document.querySelector('.color-option[data-color="#94a3b8"]')); document.getElementById('modal-option').classList.add('active'); };
const saveOption = () => { const text = document.getElementById('input-option').value.trim(); if (!text) return; state.options.push({ id: Date.now().toString(), folderId: state.activeFolderId, text, votes: 0, color: state.selectedColor, createdAt: Date.now() }); saveData(); closeModal('modal-option'); refreshUI(); };
const closeModal = (id) => { document.getElementById(id).classList.remove('active'); };

// Запуск
fetchExchangeRates();
renderFolders(); 
refreshUI();
