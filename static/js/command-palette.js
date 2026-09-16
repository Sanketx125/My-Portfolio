(function () {
  "use strict";

  const overlay = document.getElementById("palette");
  const dialog = overlay ? overlay.querySelector(".palette__dialog") : null;
  const input = document.getElementById("palette-input");
  const list = document.getElementById("palette-list");
  const empty = document.getElementById("palette-empty");
  if (!overlay || !input || !list) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ICONS = {
    section: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 7h14M5 12h14M5 17h9"/></svg>',
    project: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 3 7.5V17l9 4.5L21 17V7.5L12 3Zm0 4.3 5.2 2.6L12 12.5 6.8 9.9 12 7.3Z"/></svg>',
    action: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M13 2 4.5 13H11l-1 9L18.5 11H12l1-9Z"/></svg>',
    external: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M14 4h6v6M20 4l-8.5 8.5M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  };

  /* ---------- Build the command set from the live DOM ---------- */
  const commands = [];

  const sectionDefs = [
    ["About", "#about"], ["Skills", "#skills"], ["Projects", "#projects"],
    ["Map", "#map"], ["GitHub", "#github"], ["Experience", "#experience"],
    ["Résumé", "#resume"], ["AI assistant", "#ai-chat"], ["Contact", "#contact"],
  ];
  sectionDefs.forEach(function (def) {
    commands.push({
      id: "section-" + def[1].slice(1),
      label: "Go to " + def[0],
      group: "Navigate",
      hint: def[1],
      icon: ICONS.section,
      keywords: "section jump " + def[0].toLowerCase(),
      run: function () { scrollToSelector(def[1]); },
    });
  });

  let projects = [];
  const dataEl = document.getElementById("map-data");
  if (dataEl) { try { projects = JSON.parse(dataEl.textContent) || []; } catch (e) { projects = []; } }
  projects.forEach(function (project, index) {
    commands.push({
      id: "project-" + index,
      label: project.title,
      group: "Projects",
      hint: project.category,
      icon: ICONS.project,
      keywords: "project " + (project.stack || []).join(" ") + " " + project.category,
      run: function () { revealProject(index); },
    });
  });

  function mailto() {
    const a = document.querySelector('a[href^="mailto:"]');
    return a ? a.getAttribute("href").replace(/^mailto:/, "") : "";
  }
  function resumeHref() {
    const a = document.querySelector('a[href$="resume.pdf"]');
    return a ? a.getAttribute("href") : "";
  }
  function social(host) {
    const a = document.querySelector('.footer__socials a[href*="' + host + '"]');
    return a ? a.getAttribute("href") : "";
  }

  const actions = [
    {
      label: "Pitch me for a role",
      hint: "AI recruiter mode",
      keywords: "recruiter hire pitch ai",
      run: function () { window.dispatchEvent(new CustomEvent("chat:open-pitch")); },
    },
    {
      label: "Ask the AI assistant",
      hint: "Open chat",
      keywords: "chat ai ask question",
      run: function () { window.dispatchEvent(new CustomEvent("chat:open")); },
    },
    {
      label: "Download résumé",
      hint: "PDF",
      keywords: "resume cv pdf download",
      run: function () {
        const href = resumeHref();
        if (!href) return;
        const a = document.createElement("a");
        a.href = href; a.download = "";
        document.body.appendChild(a); a.click(); a.remove();
        window.portfolioToast && window.portfolioToast("Downloading résumé…");
      },
    },
    {
      label: "Copy email address",
      hint: "clipboard",
      keywords: "email contact copy mail",
      run: function () {
        const email = mailto();
        if (!email) return;
        navigator.clipboard && navigator.clipboard.writeText(email).then(
          function () { window.portfolioToast && window.portfolioToast("Email copied: " + email); },
          function () { window.portfolioToast && window.portfolioToast(email); }
        );
      },
    },
    {
      label: "Toggle light / dark theme",
      hint: "appearance",
      keywords: "theme dark light mode appearance",
      run: function () { window.portfolioToggleTheme && window.portfolioToggleTheme(); },
    },
  ];

  actions.forEach(function (action, i) {
    commands.push({
      id: "action-" + i,
      label: action.label,
      group: "Actions",
      hint: action.hint,
      icon: ICONS.action,
      keywords: action.keywords,
      run: action.run,
    });
  });

  const github = social("github.com");
  if (github) {
    commands.push({
      id: "link-github", label: "Open GitHub profile", group: "Links", hint: "external",
      icon: ICONS.external, keywords: "github code repos",
      run: function () { window.open(github, "_blank", "noopener"); },
    });
  }
  const linkedin = social("linkedin.com");
  if (linkedin) {
    commands.push({
      id: "link-linkedin", label: "Open LinkedIn profile", group: "Links", hint: "external",
      icon: ICONS.external, keywords: "linkedin work experience",
      run: function () { window.open(linkedin, "_blank", "noopener"); },
    });
  }

  /* ---------- Navigation helpers ---------- */
  function scrollToSelector(selector) {
    const el = document.querySelector(selector);
    if (el) el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  function revealProject(index) {
    const card = document.getElementById("project-" + index);
    if (!card) return;
    const hidden = card.classList.contains("is-hidden");
    if (hidden) {
      const all = document.querySelector('.filter-btn[data-filter="all"]');
      if (all) all.click();
    }
    card.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    card.style.outline = "2px solid var(--accent)";
    card.style.outlineOffset = "4px";
    setTimeout(function () { card.style.outline = ""; card.style.outlineOffset = ""; }, 1400);
  }

  /* ---------- Fuzzy filter + render ---------- */
  let visible = [];
  let activeIndex = 0;

  function score(needle, command) {
    const haystack = (command.label + " " + command.group + " " + (command.keywords || "")).toLowerCase();
    if (!needle) return 1;
    let pos = 0;
    for (let i = 0; i < needle.length; i++) {
      const found = haystack.indexOf(needle[i], pos);
      if (found === -1) return 0;
      pos = found + 1;
    }
    return 100 - haystack.length * 0.01;
  }

  function render(query) {
    const needle = (query || "").trim().toLowerCase();
    visible = commands
      .map(function (c) { return { c: c, s: score(needle, c) }; })
      .filter(function (x) { return x.s > 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .map(function (x) { return x.c; });

    list.innerHTML = "";
    activeIndex = 0;

    if (!visible.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    let currentGroup = null;
    visible.forEach(function (cmd, i) {
      if (cmd.group !== currentGroup) {
        currentGroup = cmd.group;
        const header = document.createElement("li");
        header.className = "palette__group";
        header.setAttribute("role", "presentation");
        header.textContent = cmd.group;
        list.appendChild(header);
      }
      const li = document.createElement("li");
      li.className = "palette__item";
      li.id = "palette-option-" + i;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", String(i === 0));
      li.innerHTML = cmd.icon + "<span>" + cmd.label + "</span>" +
        (cmd.hint ? '<span class="palette__item-hint">' + cmd.hint + "</span>" : "");
      li.addEventListener("mouseenter", function () { setActive(i); });
      li.addEventListener("click", function () { execute(i); });
      list.appendChild(li);
    });
    input.setAttribute("aria-activedescendant", "palette-option-0");
  }

  function setActive(i) {
    activeIndex = i;
    list.querySelectorAll(".palette__item").forEach(function (el, idx) {
      const selected = idx === i;
      el.setAttribute("aria-selected", String(selected));
      if (selected) {
        el.scrollIntoView({ block: "nearest" });
        input.setAttribute("aria-activedescendant", el.id);
      }
    });
  }

  function move(delta) {
    if (!visible.length) return;
    let next = activeIndex + delta;
    if (next < 0) next = visible.length - 1;
    if (next >= visible.length) next = 0;
    setActive(next);
  }

  function execute(i) {
    const cmd = visible[i];
    if (!cmd) return;
    close();
    // Let the overlay finish closing before scrolling/jumping.
    setTimeout(function () { cmd.run(); }, 40);
  }

  /* ---------- Open / close ---------- */
  let lastFocused = null;

  function open() {
    lastFocused = document.activeElement;
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    input.value = "";
    render("");
    setTimeout(function () { input.focus(); }, 30);
  }

  function close() {
    overlay.hidden = true;
    document.body.style.overflow = "";
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  window.addEventListener("palette:open", function () {
    if (overlay.hidden) open(); else close();
  });

  input.addEventListener("input", function () { render(input.value); });

  input.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Enter") { e.preventDefault(); execute(activeIndex); }
  });

  overlay.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    if (e.key === "Tab") { e.preventDefault(); input.focus(); }
  });

  overlay.addEventListener("mousedown", function (e) {
    if (dialog && !dialog.contains(e.target)) close();
  });

  document.addEventListener("keydown", function (e) {
    const tag = (e.target.tagName || "").toLowerCase();
    const typing = tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (overlay.hidden) open(); else close();
      return;
    }
    if (e.key === "/" && !typing && overlay.hidden) {
      e.preventDefault();
      open();
    }
  });
})();
