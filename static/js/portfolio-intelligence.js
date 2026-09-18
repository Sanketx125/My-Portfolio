(function () {
  "use strict";

  /* ---------- Main Tab Switching ---------- */
  const tabButtons = document.querySelectorAll("[data-pi-tab]");
  const panels = document.querySelectorAll(".pi-panel");

  function switchTab(tabId) {
    tabButtons.forEach(function (btn) {
      const active = btn.getAttribute("data-pi-tab") === tabId;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });

    panels.forEach(function (panel) {
      const active = panel.id === "pi-panel-" + tabId;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
  }

  tabButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      const tab = btn.getAttribute("data-pi-tab");
      if (tab) switchTab(tab);
    });
  });

  /* ---------- Tech Dive Subtabs ---------- */
  const subtabButtons = document.querySelectorAll("[data-td-sub]");
  const tdSections = document.querySelectorAll(".td-section");

  function switchSubtab(subId) {
    subtabButtons.forEach(function (btn) {
      const active = btn.getAttribute("data-td-sub") === subId;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });

    tdSections.forEach(function (sec) {
      const active = sec.id === "td-sub-" + subId;
      sec.classList.toggle("is-active", active);
      sec.hidden = !active;
    });
  }

  subtabButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      const sub = btn.getAttribute("data-td-sub");
      if (sub) switchSubtab(sub);
    });
  });

  /* ---------- Copy 30-sec Candidate Brief ---------- */
  const copyBtn = document.getElementById("pi-copy-profile");
  const profileTextEl = document.getElementById("pi-profile-text");

  if (copyBtn && profileTextEl) {
    copyBtn.addEventListener("click", function () {
      const text = profileTextEl.textContent.trim();
      navigator.clipboard.writeText(text).then(function () {
        if (window.portfolioToast) {
          window.portfolioToast("Candidate brief copied to clipboard!");
        }
      }).catch(function () {
        const temp = document.createElement("textarea");
        temp.value = text;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        document.body.removeChild(temp);
        if (window.portfolioToast) {
          window.portfolioToast("Candidate brief copied to clipboard!");
        }
      });
    });
  }

  /* ---------- Interactive Job Description (JD) Matcher ---------- */
  const jdTextarea = document.getElementById("pi-jd-textarea");
  const analyzeBtn = document.getElementById("pi-analyze-jd-btn");
  const deepAiBtn = document.getElementById("pi-deep-ai-jd-btn");
  const clearBtn = document.getElementById("pi-clear-jd-btn");
  const resultsContainer = document.getElementById("pi-jd-results");
  const scoreBadge = document.getElementById("pi-score-badge");
  const scoreSummary = document.getElementById("pi-score-summary");
  const matchedSkillsList = document.getElementById("pi-matched-skills");
  const matchedProjectsList = document.getElementById("pi-matched-projects");
  const presetButtons = document.querySelectorAll(".pi-sample-jd-btn");

  // Generated from content.py. Only positive records with verified evidence IDs
  // reach the browser; absence always means "not demonstrated".
  const SKILL_INDEX = (window.VERIFIED_CAPABILITIES || []).map(function (capability) {
    return {
      key: capability.label,
      evidenceIds: capability.evidence_ids,
      aliases: capability.aliases.map(function (alias) { return alias.toLowerCase(); }),
    };
  });

  function extractNamedRequirements(text) {
    const generic = new Set(["Looking", "Seeking", "Required", "Requirements", "Experience", "Engineer", "Developer", "Senior", "Skills", "Must", "Strong"]);
    const found = text.match(/\b(?:[A-Z][A-Za-z0-9.+#-]*)(?:\s+[A-Z][A-Za-z0-9.+#-]*)?\b/g) || [];
    return Array.from(new Set(found.map(function (term) { return term.trim(); }).filter(function (term) {
      return term.length > 1 && !generic.has(term) && !SKILL_INDEX.some(function (cap) {
        const lower = term.toLowerCase();
        return cap.aliases.some(function (alias) { return lower.includes(alias) || alias.includes(lower); });
      });
    })));
  }

  const PROJECT_MAPPING = [
    {
      title: "NakshAI_LiDAR Software (6-Model Ensemble)",
      keywords: ["lidar", "point cloud", "geospatial", "pytorch", "classification", "pipeline", "geoai"],
      desc: "Integrated 6+ AI models to classify geological entities from survey point clouds as an alternative to Bentley MicroStation.",
      category: "Geospatial AI",
    },
    {
      title: "PointNet++ for 3D LiDAR Classification",
      keywords: ["pointnet", "point cloud", "lidar", "csf", "cloth simulation", "3d"],
      desc: "Direct raw point cloud hierarchical learning with physical CSF ground filtering for normalized height metrics.",
      category: "3D Deep Learning",
    },
    {
      title: "Drone & Dashcam Road Survey Detection",
      keywords: ["drone", "dashcam", "yolo", "computer vision", "detection", "road", "segmentation"],
      desc: "YOLOv8/v12 model running on highway corridor footage for vehicle, crack, lane, and buffer zone detection.",
      category: "Computer Vision",
    },
    {
      title: "Bangalore Traffic Density Analytics Dashboard",
      keywords: ["traffic", "vehicle", "dashboard", "yolo", "computer vision", "dataset"],
      desc: "Custom 10,000+ Indian vehicle dataset annotated & trained for class-wise detection and density estimation.",
      category: "Computer Vision / Analytics",
    },
    {
      title: "Production RAG & Agentic LLM Automation",
      keywords: ["llm", "rag", "langchain", "agentic", "agents", "fine-tuning", "chatbot", "gpt"],
      desc: "Domain-adapted open-source models with hybrid retrieval and tool execution for backend automation.",
      category: "Generative AI",
    },
  ];

  function runJdMatch(text) {
    if (!text || !text.trim()) {
      if (window.portfolioToast) window.portfolioToast("Please paste a job description or select a sample preset.");
      return;
    }

    // Bound input size to 5,000 characters
    if (text.length > 5000) {
      text = text.slice(0, 5000);
    }

    const matchedSkills = [];
    const lowerText = text.toLowerCase();
    SKILL_INDEX.forEach(function (item) {
      if (item.aliases.some(function (alias) { return lowerText.includes(alias); })) {
        matchedSkills.push(item.key);
      }
    });

    const unmatchedSkills = extractNamedRequirements(text);

    const lower = text.toLowerCase();
    const matchedProjects = [];
    PROJECT_MAPPING.forEach(function (proj) {
      let hits = 0;
      proj.keywords.forEach(function (kw) {
        if (lower.includes(kw)) hits++;
      });
      if (hits > 0) {
        matchedProjects.push({ ...proj, hits: hits });
      }
    });
    matchedProjects.sort(function (a, b) { return b.hits - a.hits; });

    // Render results
    if (resultsContainer) {
      resultsContainer.hidden = false;

      // Factual alignment logic (no fake percentages)
      const count = matchedSkills.length;
      let badgeClass = "pi-score-badge--high";
      let ratingText = `High Alignment (${count} Verified Competencies)`;
      let summaryText = `Sanket directly demonstrates ${count} core technologies & competencies from your requirements in shipped production systems.`;

      if (count <= 1) {
        badgeClass = "pi-score-badge--med";
        ratingText = "Foundational Adjacency";
        summaryText = "Sanket's core background in PyTorch, deep learning fundamentals, and systems debugging provides foundational adjacency.";
      } else if (count <= 3) {
        badgeClass = "pi-score-badge--high";
        ratingText = `Solid Alignment (${count} Verified Competencies)`;
        summaryText = `Sanket aligns directly with ${count} key technical competencies with documented production models and pipelines.`;
      }

      if (scoreBadge) {
        scoreBadge.className = "pi-score-badge " + badgeClass;
        scoreBadge.textContent = ratingText;
      }
      if (scoreSummary) {
        scoreSummary.textContent = summaryText;
      }

      // Render matched skill chips
      if (matchedSkillsList) {
        matchedSkillsList.innerHTML = "";
        if (matchedSkills.length === 0) {
          const li = document.createElement("li");
          li.className = "chip";
          li.textContent = "AI/ML Fundamentals & PyTorch (Foundational Match)";
          matchedSkillsList.appendChild(li);
        } else {
          matchedSkills.forEach(function (skill) {
            const li = document.createElement("li");
            li.className = "chip chip--accent";
            li.textContent = "✓ " + skill;
            matchedSkillsList.appendChild(li);
          });
        }
      }

      // Render unmatched / missing skill chips
      const unmatchedContainer = document.getElementById("pi-unmatched-container");
      const unmatchedSkillsList = document.getElementById("pi-unmatched-skills");
      if (unmatchedContainer && unmatchedSkillsList) {
        if (unmatchedSkills.length > 0) {
          unmatchedContainer.hidden = false;
          unmatchedSkillsList.innerHTML = "";
          unmatchedSkills.forEach(function (skill) {
            const li = document.createElement("li");
            li.className = "chip chip--subtle";
            li.textContent = "Not demonstrated in current portfolio: " + skill;
            unmatchedSkillsList.appendChild(li);
          });
        } else {
          unmatchedContainer.hidden = true;
          unmatchedSkillsList.innerHTML = "";
        }
      }

      // Render matched projects
      if (matchedProjectsList) {
        matchedProjectsList.innerHTML = "";
        const topProjects = matchedProjects.length > 0 ? matchedProjects.slice(0, 3) : PROJECT_MAPPING.slice(0, 2);
        topProjects.forEach(function (proj) {
          const item = document.createElement("div");
          item.className = "pi-matched-proj-card";
          item.innerHTML = `
            <div>
              <span class="badge" style="font-size: 0.7rem;">${proj.category}</span>
              <h5 style="margin: 4px 0 2px; font-size: var(--fs-sm); color: var(--text);">${proj.title}</h5>
              <p style="margin: 0; font-size: var(--fs-xs); color: var(--text-2);">${proj.desc}</p>
            </div>
          `;
          matchedProjectsList.appendChild(item);
        });
      }

      resultsContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  if (analyzeBtn && jdTextarea) {
    analyzeBtn.addEventListener("click", function () {
      runJdMatch(jdTextarea.value);
    });
  }

  if (clearBtn && jdTextarea) {
    clearBtn.addEventListener("click", function () {
      jdTextarea.value = "";
      if (resultsContainer) resultsContainer.hidden = true;
    });
  }

  // Sample preset buttons
  presetButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      const content = btn.getAttribute("data-jd");
      if (content && jdTextarea) {
        jdTextarea.value = content;
        runJdMatch(content);
      }
    });
  });

  // Deep AI Fit Report via chat panel
  if (deepAiBtn && jdTextarea) {
    deepAiBtn.addEventListener("click", function () {
      const jd = jdTextarea.value.trim();
      if (!jd) {
        if (window.portfolioToast) window.portfolioToast("Please paste or choose a job description first.");
        return;
      }
      window.dispatchEvent(new CustomEvent("chat:jd-match", { detail: { jd: jd } }));
    });
  }

  // Global listeners for external navigation
  window.addEventListener("pi:open-tab", function (e) {
    if (e.detail && e.detail.tab) {
      switchTab(e.detail.tab);
      const el = document.getElementById("portfolio-intelligence");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  });

  window.addEventListener("pi:paste-jd", function () {
    switchTab("recruiter");
    const el = document.getElementById("paste-jd");
    if (el) el.scrollIntoView({ behavior: "smooth" });
    if (jdTextarea) jdTextarea.focus();
  });

})();
