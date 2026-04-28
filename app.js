/* ============================================================
   Visha AI – app.js (Groq Version)
   ============================================================ */

'use strict';

// ── Constants ──────────────────────────────────────────────
// Proxy added to prevent "Failed to fetch" CORS error in browser
// More robust proxy for Groq API
const GROQ_API_URL = 'https://corsproxy.io/?' + encodeURIComponent('https://api.groq.com/openai/v1/chat/completions');
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const MAX_RETRIES = 3;

const SYSTEM_PROMPT = `You are Visha AI, a friendly and smart student study assistant. Help students understand difficult concepts in simple language. Always explain with examples. Keep answers short and clear. You specialize in Math, Science, History, and English for Indian students.

Additional guidelines:
- Use simple, easy-to-understand English. Avoid heavy jargon.
- When relevant, use Indian context: Indian history, NCERT-style explanations, rupee (₹), Indian cities/names in examples.
- For Math problems, show step-by-step solutions clearly.
- For Science, give real-life Indian examples (e.g., monsoon, Indian animals, etc.).
- Be warm, encouraging, and patient — like a friendly elder sibling or tutor.`;

const SUBJECT_CONFIG = {
  General:  { icon: '⭐', color: '#a855f7', hint: 'Ask me anything!' },
  Math:     { icon: '🧮', color: '#f97316', hint: 'Show me a problem to solve!' },
  Science:  { icon: '🧪', color: '#22c55e', hint: 'What concept shall we explore?' },
  History:  { icon: '📜', color: '#eab308', hint: 'Which event or period?' },
  English:  { icon: '📘', color: '#3b82f6', hint: 'Grammar, essay, or comprehension?' },
};

const QUICK_PROMPTS = {
  General:  ['How do I study better?', 'Tips for exam preparation', 'Explain a tough topic simply'],
  Math:     ['Explain Pythagoras theorem', 'How to solve quadratic equations?'],
  Science:  ['How does photosynthesis work?', 'What is Newton\'s first law?'],
  History:  ['Tell me about the Indian Independence movement', 'Who was Chandragupta Maurya?'],
  English:  ['What are the tenses in English?', 'How to write a good essay?'],
};

const MOTIVATIONAL_QUOTES = [
  "💡 Tip of the day: Consistency beats talent!",
  "🚀 Keep going, you're doing great!",
  "🧠 The more you learn, the more you grow.",
  "✨ Your hard work will pay off soon!",
  "📚 Knowledge is the most powerful weapon.",
  "💪 Success is not final, failure is not fatal.",
  "🌟 Believe in yourself and anything is possible!"
];

// ── State ──────────────────────────────────────────────────
let apiKey = localStorage.getItem('visha_api_key') || '';
let currentSubject = 'General';
let chatHistory = []; // { role, content }
let isLoading = false;

// ── DOM Refs ────────────────────────────────────────────────
const splash          = document.getElementById('splash-screen');
const apiModal        = document.getElementById('api-modal');
const app             = document.getElementById('app');
const apiKeyInput     = document.getElementById('api-key-input');
const saveKeyBtn      = document.getElementById('save-api-key-btn');
const chatMessages    = document.getElementById('chat-messages');
const userInput       = document.getElementById('user-input');
const sendBtn         = document.getElementById('send-btn');
const charCount       = document.getElementById('char-count');
const quickPrompts    = document.getElementById('quick-prompts');
const currentSubjectIcon  = document.getElementById('current-subject-icon');
const currentSubjectLabel = document.getElementById('current-subject-label');
const subjectChip     = document.getElementById('subject-chip');
const sidebar         = document.getElementById('sidebar');
const motivationalBanner = document.getElementById('motivational-banner');

// ── Init ────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    splash.style.display = 'none';
    if (apiKey) {
      showApp();
    } else {
      showApiModal();
    }
  }, 1500);
});

function showApiModal() { apiModal.classList.remove('hidden'); }
function hideApiModal() { apiModal.classList.add('hidden'); }

saveKeyBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (!key) return;
  apiKey = key;
  localStorage.setItem('visha_api_key', key);
  hideApiModal();
  showApp();
});

function showApp() {
  app.classList.remove('hidden');
  updateMotivationalQuote();
  renderWelcome();
  renderQuickPrompts();
  userInput.focus();
}

function updateMotivationalQuote() {
  const quote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
  if (motivationalBanner) motivationalBanner.textContent = quote;
}

// ── Chat Logic ──────────────────────────────────────────────
async function sendMessage() {
  const text = userInput.value.trim();
  if (!text || isLoading) return;

  // UI Reset
  userInput.value = '';
  autoResize();
  charCount.textContent = '0/2000';
  document.getElementById('quick-prompts-container').style.display = 'none';
  
  appendUserMessage(text);
  
  // Add to history
  if (chatHistory.length === 0) {
    chatHistory.push({ role: "system", content: SYSTEM_PROMPT });
  }
  chatHistory.push({ role: "user", content: currentSubject === 'General' ? text : `[Subject: ${currentSubject}] ${text}` });

  const typingEl = showTyping();
  isLoading = true;
  sendBtn.disabled = true;

  try {
    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: chatHistory,
        temperature: 0.7,
        max_tokens: 1024
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const reply = data.choices[0].message.content;
    
    chatHistory.push({ role: "assistant", content: reply });
    removeTyping(typingEl);
    appendBotMessage(reply, currentSubject);
  } catch (err) {
    removeTyping(typingEl);
    appendBotMessage(`⚠️ Error: ${err.message}. Please check your Groq API key.`, 'General');
  } finally {
    isLoading = false;
    sendBtn.disabled = false;
    userInput.focus();
  }
}

// ── Rendering & Utils ───────────────────────────────────────
function appendUserMessage(text) {
  const row = document.createElement('div');
  row.className = 'msg-row user';
  row.innerHTML = `<div class="msg-avatar">👤</div><div class="msg-content"><div class="msg-bubble">${escapeHtml(text)}</div></div>`;
  chatMessages.appendChild(row);
  scrollToBottom();
}

function appendBotMessage(markdown, subject) {
  const row = document.createElement('div');
  row.className = 'msg-row bot';
  row.innerHTML = `<div class="msg-avatar">🎓</div><div class="msg-content"><div class="msg-bubble">${renderMarkdown(markdown)}</div></div>`;
  chatMessages.appendChild(row);
  scrollToBottom();
}

function showTyping() {
  const row = document.createElement('div');
  row.className = 'msg-row bot typing-row';
  row.innerHTML = `<div class="msg-avatar">🎓</div><div class="msg-content"><div class="msg-bubble"><div class="typing-indicator"><span></span><span></span><span></span></div></div></div>`;
  chatMessages.appendChild(row);
  scrollToBottom();
  return row;
}

function removeTyping(el) { el?.remove(); }
function scrollToBottom() { chatMessages.scrollTop = chatMessages.scrollHeight; }
function escapeHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function autoResize() {
  userInput.style.height = 'auto';
  userInput.style.height = Math.min(userInput.scrollHeight, 140) + 'px';
}

function renderMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

// Event Listeners
userInput.addEventListener('input', () => {
  autoResize();
  charCount.textContent = `${userInput.value.length}/2000`;
});

userInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendBtn.addEventListener('click', sendMessage);

document.querySelectorAll('.subject-btn, .tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentSubject = btn.dataset.subject;
    const cfg = SUBJECT_CONFIG[currentSubject];
    
    // Update UI elements
    currentSubjectIcon.textContent = cfg.icon;
    currentSubjectLabel.textContent = currentSubject;
    if (subjectChip) subjectChip.style.setProperty('--chip-color', cfg.color);
    
    // Toggle active class on all buttons (sync sidebar and mobile)
    document.querySelectorAll('.subject-btn, .tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.subject === currentSubject);
    });

    chatHistory = []; // Clear history on subject change
    appendBotMessage(`Switched to **${currentSubject}** mode. ${cfg.hint}`, currentSubject);
    renderQuickPrompts();

    // On mobile, close sidebar and overlay after selection
    if (window.innerWidth <= 768) {
      sidebar?.classList.remove('open');
      document.getElementById('sidebar-overlay')?.classList.remove('show');
    }
  });
});

function renderQuickPrompts() {
  const prompts = QUICK_PROMPTS[currentSubject] || QUICK_PROMPTS.General;
  quickPrompts.innerHTML = '';
  prompts.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'quick-btn';
    btn.textContent = p;
    btn.onclick = () => { userInput.value = p; sendMessage(); };
    quickPrompts.appendChild(btn);
  });
}

function renderWelcome() {
  const div = document.createElement('div');
  div.className = 'welcome-card';
  div.innerHTML = `
    <div class="welcome-logo-wrap">
      <span class="welcome-emoji logo-animated">🎓</span>
    </div>
    <h3>Vanakkam! I'm Visha AI</h3>
    <p>Your premium study assistant. Let's make learning exciting! 🚀</p>
    <div class="welcome-stats">
      <div class="stat-item"><span>📚</span> Subjects</div>
      <div class="stat-item"><span>⚡</span> Fast AI</div>
      <div class="stat-item"><span>❤️</span> For You</div>
    </div>
  `;
  chatMessages.appendChild(div);
  scrollToBottom();
}
// Sidebar & Menu Logic
const menuToggle = document.getElementById('menu-toggle');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const clearChatBtn = document.getElementById('clear-chat-btn');

menuToggle?.addEventListener('click', () => {
  sidebar?.classList.add('open');
  sidebarOverlay?.classList.add('show');
});

sidebarOverlay?.addEventListener('click', () => {
  sidebar?.classList.remove('open');
  sidebarOverlay?.classList.remove('show');
});

clearChatBtn?.addEventListener('click', () => {
  if (confirm('Are you sure you want to clear the entire chat?')) {
    chatMessages.innerHTML = '';
    chatHistory = [];
    document.getElementById('quick-prompts-container').style.display = 'block';
    renderWelcome();
  }
});
