/* ============================================================
   Vidya AI – app.js (Groq Version)
   ============================================================ */

'use strict';

// ── Constants ──────────────────────────────────────────────
// Proxy added to prevent "Failed to fetch" CORS error in browser
// More robust proxy for Groq API
const GROQ_API_URL = 'https://corsproxy.io/?' + encodeURIComponent('https://api.groq.com/openai/v1/chat/completions');
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const MAX_RETRIES = 3;

const SYSTEM_PROMPT = `You are Vidya AI, a friendly and smart student study assistant. Help students understand difficult concepts in simple language. Always explain with examples. Keep answers short and clear. You specialize in Math, Science, History, and English for Indian students.

Additional guidelines:
- Use simple, easy-to-understand English. Avoid heavy jargon.
- When relevant, use Indian context: Indian history, NCERT-style explanations, rupee (₹), Indian cities/names in examples.
- For Math problems, show step-by-step solutions clearly.
- For Science, give real-life Indian examples (e.g., monsoon, Indian animals, etc.).
- Be warm, encouraging, and patient — like a friendly elder sibling or tutor.`;

const SUBJECT_CONFIG = {
  General:  { icon: '💬', color: '#7c6af7', hint: 'Ask me anything!' },
  Math:     { icon: '📐', color: '#f59e0b', hint: 'Show me a problem to solve!' },
  Science:  { icon: '🔬', color: '#22c55e', hint: 'What concept shall we explore?' },
  History:  { icon: '📜', color: '#ef4444', hint: 'Which event or period?' },
  English:  { icon: '📝', color: '#3b82f6', hint: 'Grammar, essay, or comprehension?' },
};

const QUICK_PROMPTS = {
  General:  ['How do I study better?', 'Tips for exam preparation', 'Explain a tough topic simply'],
  Math:     ['Explain Pythagoras theorem', 'How to solve quadratic equations?'],
  Science:  ['How does photosynthesis work?', 'What is Newton\'s first law?'],
  History:  ['Tell me about the Indian Independence movement', 'Who was Chandragupta Maurya?'],
  English:  ['What are the tenses in English?', 'How to write a good essay?'],
};

// ── State ──────────────────────────────────────────────────
let apiKey = localStorage.getItem('vidya_api_key') || '';
let currentSubject = 'General';
let conversationHistory = []; // { role, content }
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

// ── Init ────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    splash.style.display = 'none';
    if (apiKey) {
      showApp();
    } else {
      showApiModal();
    }
  }, 2700);
});

function showApiModal() { apiModal.classList.remove('hidden'); }
function hideApiModal() { apiModal.classList.add('hidden'); }

saveKeyBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (!key) return;
  apiKey = key;
  localStorage.setItem('vidya_api_key', key);
  hideApiModal();
  showApp();
});

function showApp() {
  app.classList.remove('hidden');
  renderWelcome();
  renderQuickPrompts();
  userInput.focus();
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
  if (conversationHistory.length === 0) {
    conversationHistory.push({ role: "system", content: SYSTEM_PROMPT });
  }
  conversationHistory.push({ role: "user", content: currentSubject === 'General' ? text : `[Subject: ${currentSubject}] ${text}` });

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
        messages: conversationHistory,
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
    
    conversationHistory.push({ role: "assistant", content: reply });
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
    currentSubjectIcon.textContent = cfg.icon;
    currentSubjectLabel.textContent = currentSubject;
    subjectChip.style.setProperty('--chip-color', cfg.color);
    renderQuickPrompts();
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
    <span class="welcome-emoji">🎓</span>
    <h3>Vanakkam! I'm Vidya AI</h3>
    <p>Your personal study buddy powered by Groq! Ask me anything about <strong>Math, Science, History, or English</strong>.</p>
  `;
  chatMessages.appendChild(div);
  scrollToBottom();
}
