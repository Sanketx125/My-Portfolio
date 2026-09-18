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
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let mode = "default";

  /* ---------- Session + persistence ---------- */
  function getSessionId() {
    let id = null;
    try { id = sessionStorage.getItem(SESSION_KEY); } catch (e) { /* ignore */ }
    if (!id) {
      id = crypto.randomUUID();
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

  /* ---------- Safe, robust mini-markdown (escape first, then add structure) ---------- */
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function formatInline(raw) {
    // 1. Code spans first: `code`
    let text = raw.replace(/`([^`]+)`/g, "<code>$1</code>");

    // 2. Colon after bold: **something**: or **something** :
    text = text.replace(/\*\*([^*]+)\*\*\s*:/g, "<strong>$1</strong>:");

    // 3. Complete bold pairs: **bold**
    text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

    // 4. Dangling trailing **: before colon (repair LLM missing opening ** bug)
    text = text.replace(/(^|[\s(])([a-zA-Z0-9_-]+)\*\*:/g, "$1<strong>$2</strong>:");
    // Clean up any remaining lone unmatched ** tokens
    text = text.replace(/\*\*/g, "");

    // 5. Markdown links. Parse the destination before emitting any href.
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, label, href) {
      const value = href.trim();
      const allowedFragment = /^#(?:projects|experience|recognition)$/.test(value);
      const allowedScheme = /^(?:https?:|mailto:)/i.test(value);
      if (!allowedFragment && !allowedScheme) return label;
      const external = /^https?:/i.test(value);
      return '<a href="' + value + '"' + (external ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + label + '</a>';
    });

    // 6. Bare links: http(s) only.
    text = text.replace(/(^|[\s(])(https?:\/\/[^\s<"']+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');

    return text;
  }

  function markdownToHtml(text) {
    if (!text || typeof text !== "string") return "<p></p>";

    // Escape all raw HTML first to guarantee that no script or tag executes
    const safeText = escapeHtml(text);

    // Handle code blocks ```lang ... ```
    const codeBlocks = [];
    const textWithoutBlocks = safeText.replace(/```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g, function (_, lang, code) {
      const idx = codeBlocks.length;
      codeBlocks.push(`<pre><code class="code-block">${code.trim()}</code></pre>`);
      return `@@CODE_BLOCK_${idx}@@`;
    });

    const lines = textWithoutBlocks.split(/\r?\n/);
    let html = "";
    let listStack = [];

    function closeListsToLevel(level) {
      while (listStack.length > level) {
        const item = listStack.pop();
        html += `</li></${item.type}>`;
      }
    }

    function closeAllLists() {
      closeListsToLevel(0);
    }

    lines.forEach(function (line) {
      const codeMatch = line.trim().match(/^@@CODE_BLOCK_(\d+)@@$/);
      if (codeMatch) {
        closeAllLists();
        html += codeBlocks[Number(codeMatch[1])];
        return;
      }

      const h3Match = line.match(/^###\s+(.*)$/);
      const h2Match = line.match(/^##\s+(.*)$/);
      const h1Match = line.match(/^#\s+(.*)$/);
      if (h3Match || h2Match || h1Match) {
        closeAllLists();
        const content = formatInline((h3Match || h2Match || h1Match)[1]);
        const tag = h3Match ? "h4" : "h3";
        html += `<${tag} class="chat-heading">${content}</${tag}>`;
        return;
      }

      const bulletMatch = line.match(/^(\s*)([-*])\s+(.*)$/);
      const numMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);

      if (bulletMatch || numMatch) {
        const match = bulletMatch || numMatch;
        const indent = match[1].length;
        const type = bulletMatch ? "ul" : "ol";
        const content = formatInline(match[3]);
        const level = Math.floor(indent / 2) + 1;

        if (listStack.length < level) {
          html += `<${type}><li>${content}`;
          listStack.push({ type: type, level: level });
        } else if (listStack.length > level) {
          closeListsToLevel(level);
          html += `</li><li>${content}`;
        } else {
          if (listStack[listStack.length - 1].type !== type) {
            closeListsToLevel(level - 1);
            html += `<${type}><li>${content}`;
            listStack.push({ type: type, level: level });
          } else {
            html += `</li><li>${content}`;
          }
        }
        return;
      }

      closeAllLists();
      const trimmed = line.trim();
      if (trimmed) {
        html += `<p>${formatInline(trimmed)}</p>`;
      }
    });

    closeAllLists();
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

  function renderAssistantReply(text) {
    if (reduceMotion) return Promise.resolve(renderBubble("assistant", text));
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble chat-bubble--assistant is-typing";
    bubble.setAttribute("aria-busy", "true");
    messagesEl.appendChild(bubble);
    let index = 0;
    const delay = Math.max(6, Math.min(18, Math.floor(2600 / Math.max(text.length, 1))));
    return new Promise(function (resolve) {
      function step() {
        index = Math.min(index + 2, text.length);
        bubble.textContent = text.slice(0, index);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        if (index < text.length) {
          setTimeout(step, delay);
        } else {
          bubble.innerHTML = markdownToHtml(text);
          bubble.classList.remove("is-typing");
          bubble.removeAttribute("aria-busy");
          resolve(bubble);
        }
      }
      step();
    });
  }

  function renderWelcome() {
    const lead = mode === "recruiter"
      ? "Recruiter mode on. I'll make the case for hiring Sanket — ask about fit for a role, or hit the pitch button below."
      : (mode === "jd_match"
        ? "Paste JD mode on. Share a job description or list of requirements and I'll generate a verified fit assessment."
        : "Hi! Ask me anything about Sanket's background, skills, or projects.");
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
      : (next === "jd_match"
        ? "Paste job description or requirements..."
        : "Ask about my work...");
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

  window.addEventListener("chat:ask", function (e) {
    if (e.detail && e.detail.message) {
      openPanel();
      sendMessage(e.detail.message);
    }
  });

  window.addEventListener("chat:jd-match", function (e) {
    if (e.detail && e.detail.jd) {
      setMode("jd_match");
      openPanel();
      sendMessage(e.detail.jd, "Evaluate Job Description Fit");
    }
  });

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
      const res = await window.PortfolioAPI.request("/api/chat", {
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

      history.push({ role: "assistant", content: data.reply });
      saveHistory();
      await renderAssistantReply(data.reply);
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
