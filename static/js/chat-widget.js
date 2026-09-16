(function () {
  "use strict";

  const widget = document.getElementById("chat-widget");
  const launcher = document.getElementById("chat-launcher");
  const panel = document.getElementById("chat-panel");
  const closeBtn = document.getElementById("chat-close");
  const clearBtn = document.getElementById("chat-clear");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const messagesEl = document.getElementById("chat-messages");
  const modeButtons = document.querySelectorAll("[data-chat-mode]");

  if (!widget || !launcher || !panel || !form) return;

  const STORAGE_KEY = "portfolio_chat_history";
  const SESSION_KEY = "portfolio_chat_session_id";
  const PITCH_SENTINEL = "__pitch__";

  let mode = "default";

  /* ---------- Session + persistence ---------- */
  function getSessionId() {
    let id = null;
    try { id = sessionStorage.getItem(SESSION_KEY); } catch (e) { /* ignore */ }
    if (!id) {
      id = "sess-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      try { sessionStorage.setItem(SESSION_KEY, id); } catch (e) { /* ignore */ }
    }
    return id;
  }

  function loadHistory() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function saveHistory() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch (e) { /* ignore */ }
  }

  let history = loadHistory();

  /* ---------- Safe mini-markdown (escape first, then add structure) ---------- */
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function inline(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  }

  function markdownToHtml(text) {
    const lines = escapeHtml(text).split(/\r?\n/);
    let html = "";
    let listType = null;

    function closeList() {
      if (listType) { html += "</" + listType + ">"; listType = null; }
    }

    lines.forEach(function (line) {
      const trimmed = line.trim();
      const bullet = trimmed.match(/^[-*]\s+(.*)$/);
      const numbered = trimmed.match(/^\d+\.\s+(.*)$/);

      if (bullet || numbered) {
        const wanted = bullet ? "ul" : "ol";
        if (listType !== wanted) { closeList(); html += "<" + wanted + ">"; listType = wanted; }
        html += "<li>" + inline((bullet || numbered)[1]) + "</li>";
        return;
      }
      closeList();
      if (trimmed) html += "<p>" + inline(trimmed) + "</p>";
    });

    closeList();
    return html || "<p></p>";
  }

  /* ---------- Rendering ---------- */
  function renderBubble(role, text) {
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble chat-bubble--" + role;
    if (role === "assistant") bubble.innerHTML = markdownToHtml(text);
    else bubble.textContent = text;
    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return bubble;
  }

  function renderWelcome() {
    const lead = mode === "recruiter"
      ? "Recruiter mode on. I'll make the case for hiring Sanket — ask about fit for a role, or hit the pitch button below."
      : "Hi! Ask me anything about Sanket's background, skills, or projects.";
    renderBubble("assistant", lead);
  }

  function replay() {
    messagesEl.innerHTML = "";
    if (!history.length) { renderWelcome(); return; }
    history.forEach(function (m) { renderBubble(m.role, m.content); });
  }

  function showTyping() {
    const typing = document.createElement("div");
    typing.className = "chat-typing";
    typing.id = "chat-typing";
    typing.innerHTML = "<span></span><span></span><span></span>";
    messagesEl.appendChild(typing);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    const typing = document.getElementById("chat-typing");
    if (typing) typing.remove();
  }

  /* ---------- Open / close ---------- */
  function openPanel() {
    widget.classList.add("is-open");
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    replay();
    setTimeout(function () { input.focus(); }, 60);
  }

  function closePanel() {
    widget.classList.remove("is-open");
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
  }

  launcher.addEventListener("click", function () {
    if (panel.hidden) openPanel(); else closePanel();
  });
  closeBtn.addEventListener("click", closePanel);

  clearBtn.addEventListener("click", function () {
    history = [];
    saveHistory();
    replay();
    input.focus();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !panel.hidden) closePanel();
  });

  ["open-chat-hero", "open-chat-section"].forEach(function (id) {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", openPanel);
  });

  /* ---------- Mode toggle ---------- */
  function setMode(next) {
    mode = next;
    modeButtons.forEach(function (btn) {
      const active = btn.getAttribute("data-chat-mode") === next;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
    input.placeholder = next === "recruiter"
      ? "Ask about fit for a role..."
      : "Ask about my work...";
    if (!history.length) replay();
  }

  modeButtons.forEach(function (btn) {
    btn.addEventListener("click", function () { setMode(btn.getAttribute("data-chat-mode")); });
  });

  // Recruiter pitch: opened from the hero / AI section / command palette.
  function openPitch() {
    setMode("recruiter");
    openPanel();
    sendMessage(PITCH_SENTINEL, "Pitch me for a role");
  }

  window.addEventListener("chat:open", openPanel);
  window.addEventListener("chat:open-pitch", openPitch);

  document.querySelectorAll("[data-open-pitch]").forEach(function (btn) {
    btn.addEventListener("click", openPitch);
  });

  window.addEventListener("chat:open-with-prompt", function (e) {
    const detail = e.detail || {};
    const prompt = typeof detail === "string" ? detail : detail.prompt;
    openPanel();
    input.value = prompt || "";
    input.focus();
  });

  /* ---------- Send ---------- */
  async function sendMessage(text, displayText) {
    renderBubble("user", displayText || text);
    history.push({ role: "user", content: displayText || text });
    saveHistory();
    showTyping();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, session_id: getSessionId(), mode: mode }),
      });
      const data = await res.json().catch(function () { return {}; });
      hideTyping();

      if (!res.ok || data.error) {
        renderBubble("error", (data && data.error) || "Something went wrong. Please try the contact form below.");
        return;
      }

      renderBubble("assistant", data.reply);
      history.push({ role: "assistant", content: data.reply });
      saveHistory();
    } catch (err) {
      hideTyping();
      renderBubble("error", "Couldn't reach the assistant right now — please use the contact form below.");
    }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    sendMessage(text);
  });
})();
