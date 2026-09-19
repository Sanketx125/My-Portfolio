(function () {
  "use strict";
  const config = window.PORTFOLIO_CONFIG;
  let challengeReady;
  function challenge(action) {
    if (!config.production) return Promise.resolve("");
    if (!config.turnstileSiteKey) return Promise.reject(new Error("Verification is unavailable."));
    if (!challengeReady) challengeReady = new Promise(function (resolve, reject) {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.onload = resolve;
      script.onerror = function (e) { challengeReady = null; reject(e); };
      document.head.appendChild(script);
    });
    return challengeReady.then(function () {
      return new Promise(function (resolve, reject) {
        const container = document.createElement("div");
        const host = document.getElementById(action === "chat" ? "chat-form" : "contact-form");
        host.appendChild(container);
        let widget;
        const timer = setTimeout(function () { finish(null); }, 90000);
        function finish(token) {
          clearTimeout(timer);
          if (widget !== undefined) window.turnstile.remove(widget);
          container.remove();
          if (token) resolve(token); else reject(new Error("Please retry verification."));
        }
        // Injected scripts are async and make the ready hook throw; onload already guarantees the API exists.
        try {
          widget = window.turnstile.render(container, {
            sitekey: config.turnstileSiteKey, action: action, appearance: "interaction-only",
            callback: finish, "error-callback": function () { finish(null); },
            "expired-callback": function () { finish(null); }
          });
        } catch (error) { finish(null); }
      });
    });
  }
  window.PortfolioAPI = {
    async request(path, options) {
      options = options || {};
      if (options.method === "POST") {
        const body = JSON.parse(options.body);
        body.turnstile_token = await challenge(path.split("/").pop());
        options = Object.assign({}, options, {body: JSON.stringify(body)});
      }
      return fetch(config.apiBaseUrl + path, Object.assign({credentials: "same-origin", signal: AbortSignal.timeout(35000)}, options));
    }
  };
  if (config.production) {
    window.PortfolioAPI.request("/api/github?format=html").then(function (res) {
      if (!res.ok) throw new Error("Unavailable");
      return res.json();
    }).then(function (data) {
      if (!data.configured || typeof data.html !== "string") return;
      // Server renders the original autoescaped template; never LLM/user HTML.
      const section = document.getElementById("github");
      const parsed = new DOMParser().parseFromString(data.html, "text/html");
      const replacement = parsed.getElementById("github");
      if (!replacement) return;
      replacement.querySelectorAll(".reveal").forEach(function (el) { el.style.opacity = "1"; el.style.transform = "none"; });
      replacement.querySelectorAll("[data-count-to]").forEach(function (el) { el.textContent = el.dataset.countTo; });
      section.replaceWith(replacement);
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    }).catch(function () { /* Retain curated, usable fallback. */ });
  }
})();
