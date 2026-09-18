(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Toast helper (shared with the command palette) ---------- */
  window.portfolioToast = function (message) {
    const stack = document.getElementById("toast-stack");
    if (!stack) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    stack.appendChild(toast);
    setTimeout(function () {
      toast.style.transition = "opacity .3s ease";
      toast.style.opacity = "0";
      setTimeout(function () { toast.remove(); }, 320);
    }, 2200);
  };

  /* ---------- Reading progress + nav scroll state ---------- */
  const nav = document.getElementById("nav");
  const progress = document.getElementById("progress");

  function onScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + "%";
    if (nav) nav.classList.toggle("is-scrolled", window.scrollY > 8);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  const burger = document.getElementById("nav-burger");
  const mobileMenu = document.getElementById("mobile-menu");
  if (burger && mobileMenu) {
    burger.addEventListener("click", function () {
      const isOpen = mobileMenu.classList.toggle("is-open");
      mobileMenu.hidden = !isOpen;
      burger.setAttribute("aria-expanded", String(isOpen));
    });
    mobileMenu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        mobileMenu.classList.remove("is-open");
        mobileMenu.hidden = true;
        burger.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- Scroll-spy indicator ---------- */
  const navLinks = Array.from(document.querySelectorAll("[data-nav-link]"));
  const navIndicator = document.querySelector(".nav__indicator");
  const sections = navLinks
    .map(function (link) { return document.querySelector(link.getAttribute("href")); })
    .filter(Boolean);

  function setActive(id) {
    navLinks.forEach(function (link) {
      const match = link.getAttribute("href") === "#" + id;
      link.classList.toggle("is-active", match);
      if (match && navIndicator) {
        navIndicator.style.width = link.offsetWidth + "px";
        navIndicator.style.transform = "translateX(" + link.offsetLeft + "px)";
      }
    });
  }

  function updateActiveSection() {
    if (!sections.length) return;
    const marker = window.scrollY + Math.min(window.innerHeight * 0.35, 280);
    let active = null;
    sections.forEach(function (section) {
      if (section.offsetTop <= marker) active = section;
    });
    if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 4) {
      active = sections[sections.length - 1];
    }
    if (active) setActive(active.id);
  }
  window.addEventListener("scroll", updateActiveSection, { passive: true });
  window.addEventListener("resize", updateActiveSection);
  updateActiveSection();

  /* ---------- Scroll reveal (all sections below the hero) ---------- */
  const reveals = document.querySelectorAll(".reveal");
  if (!reduceMotion && "IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        obs.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.08 });
    reveals.forEach(function (el) { revealObserver.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---------- Hero: role typewriter ---------- */
  const roleEl = document.getElementById("role-text");
  if (roleEl) {
    const roles = (roleEl.dataset.roles || "").split("\u00B7").map(function (s) { return s.trim(); }).filter(Boolean);
    if (roles.length) {
      if (reduceMotion) {
        roleEl.textContent = roles[0];
      } else {
        let roleIndex = 0, charIndex = 0, deleting = false;
        const TYPE_MS = 52, DELETE_MS = 28, HOLD_MS = 1600;
        (function tick() {
          const current = roles[roleIndex];
          if (!deleting) {
            charIndex++;
            roleEl.textContent = current.slice(0, charIndex);
            if (charIndex === current.length) { deleting = true; return setTimeout(tick, HOLD_MS); }
            return setTimeout(tick, TYPE_MS);
          }
          charIndex--;
          roleEl.textContent = current.slice(0, charIndex);
          if (charIndex === 0) {
            deleting = false;
            roleIndex = (roleIndex + 1) % roles.length;
            return setTimeout(tick, 300);
          }
          setTimeout(tick, DELETE_MS);
        })();
      }
    }
  }

  /* ---------- Hero: contour draw-in + entrance ---------- */
  const contourLines = document.querySelectorAll(".contour-line");
  if (contourLines.length && window.gsap) {
    contourLines.forEach(function (path) {
      const length = path.getTotalLength ? path.getTotalLength() : 800;
      path.style.strokeDasharray = length;
      path.style.strokeDashoffset = reduceMotion ? 0 : length;
    });

    if (!reduceMotion) {
      gsap.to(contourLines, {
        strokeDashoffset: 0, duration: 1.6, ease: "power2.out", stagger: 0.18, delay: 0.2,
      });
      gsap.from(".hero__photo-frame", { opacity: 0, scale: 0.9, duration: 0.9, delay: 0.5, ease: "power2.out" });
      gsap.from(".contour-point", { opacity: 0, scale: 0, duration: 0.5, delay: 1.7, ease: "back.out(2)" });
    }

    gsap.from(".hero__coords, .hero__badge, .hero__name, .hero__role, .hero__tagline, .hero__ctas, .hero__meta", {
      opacity: 0,
      y: reduceMotion ? 0 : 14,
      duration: reduceMotion ? 0.01 : 0.7,
      stagger: reduceMotion ? 0 : 0.08,
      ease: "power2.out",
    });
  }

  /* ---------- Hero: subtle scroll parallax via ScrollTrigger ---------- */
  if (window.gsap && window.ScrollTrigger && !reduceMotion) {
    gsap.registerPlugin(ScrollTrigger);
    gsap.to(".hero__visual", {
      yPercent: 14, ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
    });
    gsap.to(".hero__text", {
      yPercent: -6, opacity: 0.72, ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
    });
  }

  /* ---------- Count-up numbers (stats + GitHub totals) ---------- */
  function animateStat(el) {
    const raw = el.getAttribute("data-count-to") || "0";
    const match = raw.match(/[\d.]+/);
    const target = match ? parseFloat(match[0]) : 0;
    const suffix = raw.replace(/^[\d.]+/, "");
    if (reduceMotion || !target) { el.textContent = raw; return; }

    const duration = 1200;
    const start = performance.now();
    (function frame(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const value = target < 10
        ? (target * eased).toFixed(target % 1 !== 0 ? 1 : 0)
        : Math.round(target * eased).toLocaleString();
      el.textContent = value + suffix;
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = raw;
    })(start);
  }

  const stats = document.querySelectorAll("[data-count-to]");
  if (stats.length && "IntersectionObserver" in window) {
    const statObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        animateStat(entry.target);
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.5 });
    stats.forEach(function (el) { statObserver.observe(el); });
  } else {
    stats.forEach(function (el) { el.textContent = el.getAttribute("data-count-to"); });
  }

  /* ---------- Projects: filter (also refreshes the map markers) ---------- */
  const filterButtons = document.querySelectorAll(".filter-btn");
  const projectCards = document.querySelectorAll(".project-card");
  filterButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      filterButtons.forEach(function (b) { b.classList.remove("is-active"); });
      btn.classList.add("is-active");
      const filter = btn.getAttribute("data-filter");
      projectCards.forEach(function (card) {
        const show = filter === "all" || card.getAttribute("data-category") === filter;
        card.classList.toggle("is-hidden", !show);
      });
      window.dispatchEvent(new CustomEvent("projects:filtered", { detail: filter }));
    });
  });

  /* ---------- Projects: expand ---------- */
  document.querySelectorAll("[data-expand]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const card = btn.closest(".project-card");
      const detail = card.querySelector(".project-card__detail");
      const desc = card.querySelector(".project-card__desc");
      if (!detail) return;
      const expanded = !detail.hidden;
      detail.hidden = expanded;
      if (desc) desc.hidden = !expanded;
      btn.textContent = expanded ? "Read more" : "Show less";
    });
  });

  /* ---------- Sample prompt chips → open chat prefilled ---------- */
  document.querySelectorAll("[data-sample-prompt]").forEach(function (chip) {
    chip.addEventListener("click", function () {
      window.dispatchEvent(new CustomEvent("chat:open-with-prompt", {
        detail: { prompt: chip.getAttribute("data-sample-prompt") },
      }));
    });
  });

  /* ---------- Command palette open buttons ---------- */
  ["palette-open", "palette-open-footer"].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", function () {
      window.dispatchEvent(new CustomEvent("palette:open"));
    });
  });

  /* ---------- Footer year ---------- */
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
