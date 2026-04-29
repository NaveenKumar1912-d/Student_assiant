/* ============================================================
   Visha AI – app.js (Groq Version)
   ============================================================ */

'use strict';

const MAX_RETRIES = 3;

const SYSTEM_PROMPT = `You are Visha AI, a friendly and smart student study assistant. Help students understand difficult concepts in simple language. Always explain with examples. Keep answers short and clear. You specialize in Math, Science, History, and English for Indian students.

Additional guidelines:
- Use simple, easy-to-understand English. Avoid heavy jargon.
- When relevant, use Indian context: Indian history, NCERT-style explanations, rupee (₹), Indian cities/names in examples.
- For Math problems, show step-by-step solutions clearly.
- For Science, give real-life Indian examples (e.g., monsoon, Indian animals, etc.).
- Be warm, encouraging, and patient — like a friendly elder sibling or tutor.`;

const PDF_SYSTEM_PROMPT = `You are Visha AI. Answer questions based on the provided document content. If the answer is not in the document, say so clearly. Be concise, student-friendly, and helpful.`;

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
let currentSubject = 'General';
let chatHistory    = []; // { role, content } — user/assistant only, no system
let isLoading      = false;
let pdfContent     = null; // extracted text from uploaded PDF
let pdfFileName    = null; // original filename

// ── DOM Refs ────────────────────────────────────────────────
const splash              = document.getElementById('splash-screen');
const app                 = document.getElementById('app');
const chatMessages        = document.getElementById('chat-messages');
const userInput           = document.getElementById('user-input');
const sendBtn             = document.getElementById('send-btn');
const charCount           = document.getElementById('char-count');
const quickPrompts        = document.getElementById('quick-prompts');
const currentSubjectIcon  = document.getElementById('current-subject-icon');
const currentSubjectLabel = document.getElementById('current-subject-label');
const subjectChip         = document.getElementById('subject-chip');
const sidebar             = document.getElementById('sidebar');
const motivationalBanner  = document.getElementById('motivational-banner');
// PDF refs
const pdfUploadBtn   = document.getElementById('pdf-upload-btn');
const pdfUploadInput = document.getElementById('pdf-upload');
const pdfStatusBar   = document.getElementById('pdf-status-bar');
const pdfFilenameEl  = document.getElementById('pdf-filename');
const pdfRemoveBtn   = document.getElementById('pdf-remove-btn');

// ── Init ────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    splash.style.display = 'none';
    showApp();
  }, 1500);
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
  let text = userInput.value.trim();
  
  // If no text but a PDF is attached, default to asking for a summary
  if (!text && pdfContent) {
    text = "Please summarize this document and tell me the key points.";
  }
  
  if (!text || isLoading) return;

  // UI Reset
  userInput.value = '';
  autoResize();
  charCount.textContent = '0/2000';
  document.getElementById('quick-prompts-container').style.display = 'none';

  appendUserMessage(text, pdfFileName);

  // User content: include subject tag only when no PDF is active
  const userContent = pdfContent
    ? `[Attached Document: ${pdfFileName}]\n\n${text}`
    : (currentSubject === 'General' ? text : `[Subject: ${currentSubject}] ${text}`);
  chatHistory.push({ role: 'user', content: userContent });

  const typingEl = showTyping();
  isLoading = true;
  sendBtn.disabled = true;

  // Build system prompt fresh every time so PDF state is always current
  const systemContent = pdfContent
    ? `${PDF_SYSTEM_PROMPT}\n\n--- DOCUMENT CONTENT START ---\n${pdfContent.slice(0, 30000)}\n--- DOCUMENT CONTENT END ---`
    : SYSTEM_PROMPT;

  const messagesPayload = [
    { role: 'system', content: systemContent },
    ...chatHistory,
  ];

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messagesPayload }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const reply = data.choices[0].message.content;

    chatHistory.push({ role: 'assistant', content: reply });
    removeTyping(typingEl);
    appendBotMessage(reply, currentSubject);
  } catch (err) {
    removeTyping(typingEl);
    appendBotMessage(`⚠️ Error: ${err.message}. Please check your connection or try again later.`, 'General');
  } finally {
    isLoading = false;
    sendBtn.disabled = false;
    userInput.focus();
  }
}

// ── Rendering & Utils ───────────────────────────────────────
function appendUserMessage(text, attachedFile = null) {
  const row = document.createElement('div');
  row.className = 'msg-row user';
  
  let attachmentHtml = '';
  if (attachedFile) {
    attachmentHtml = `<div style="background: rgba(255,255,255,0.1); padding: 6px 10px; border-radius: 8px; font-size: 0.8rem; margin-bottom: 8px; display: inline-flex; align-items: center; gap: 6px; border: 1px solid rgba(255,255,255,0.2);">
      📄 <strong>${escapeHtml(attachedFile)}</strong>
    </div><br>`;
  }
  
  row.innerHTML = `<div class="msg-avatar">👤</div><div class="msg-content"><div class="msg-bubble">${attachmentHtml}${escapeHtml(text)}</div></div>`;
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

// ── PDF Upload Logic ─────────────────────────────────────────

// Boot PDF.js worker
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

/** Extract all text from a PDF File object using PDF.js */
async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    fullText += `\n--- Page ${i} ---\n${pageText}`;
  }
  return { text: fullText.trim(), pages: pdf.numPages };
}

/** Update all UI elements that reflect current PDF state */
function updatePdfUI(hasPdf) {
  const subtitle = document.getElementById('chat-subtitle');
  if (hasPdf) {
    pdfStatusBar?.classList.remove('hidden');
    if (pdfFilenameEl) pdfFilenameEl.textContent = pdfFileName;
    if (pdfUploadBtn)  { pdfUploadBtn.textContent = '📄'; pdfUploadBtn.classList.add('has-pdf'); }
    if (subtitle) subtitle.innerHTML = `<span class="status-dot"></span> 📄 ${escapeHtml(pdfFileName)}`;
  } else {
    pdfStatusBar?.classList.add('hidden');
    if (pdfFilenameEl) pdfFilenameEl.textContent = '';
    if (pdfUploadBtn)  { pdfUploadBtn.textContent = '📎'; pdfUploadBtn.classList.remove('has-pdf'); }
    if (subtitle) subtitle.innerHTML = `<span class="status-dot"></span> Your AI Study Buddy`;
  }
}

// Paperclip button → trigger hidden file input
pdfUploadBtn?.addEventListener('click', () => pdfUploadInput?.click());

// File selected → extract text
pdfUploadInput?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (file.type !== 'application/pdf') {
    appendBotMessage('⚠️ Please upload a valid **PDF** file only.', 'General');
    return;
  }
  if (typeof pdfjsLib === 'undefined') {
    appendBotMessage('⚠️ PDF reader is still loading. Please wait a moment and try again.', 'General');
    return;
  }

  // Loading state
  if (pdfUploadBtn) { pdfUploadBtn.textContent = '⏳'; pdfUploadBtn.disabled = true; }
  sendBtn.disabled = true;

  try {
    const { text, pages } = await extractPdfText(file);
    if (!text) throw new Error('No readable text found. The PDF may be image-only or protected.');

    pdfContent  = text;
    pdfFileName = file.name;
    chatHistory = []; // fresh context for new PDF
    updatePdfUI(true);

    const words = text.split(/\s+/).filter(Boolean).length;
    appendBotMessage(
      `📄 **${escapeHtml(file.name)}** loaded!\n\n` +
      `✅ Read **${words.toLocaleString()} words** across **${pages} page${pages !== 1 ? 's' : ''}**.\n\n` +
      `Ask me anything about this document — summaries, explanations, key points, anything!`,
      'General'
    );
  } catch (err) {
    appendBotMessage(`⚠️ Could not read the PDF: ${err.message}`, 'General');
  } finally {
    if (pdfUploadBtn) { pdfUploadBtn.disabled = false; pdfUploadBtn.textContent = pdfContent ? '📄' : '📎'; }
    sendBtn.disabled = false;
    pdfUploadInput.value = ''; // allow re-uploading same file
  }
});

// Remove PDF button
pdfRemoveBtn?.addEventListener('click', () => {
  pdfContent  = null;
  pdfFileName = null;
  chatHistory = [];
  updatePdfUI(false);
  appendBotMessage('📚 PDF removed. Back to normal study assistant mode — ask me anything!', 'General');
});
