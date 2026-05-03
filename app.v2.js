document.addEventListener("DOMContentLoaded", () => {
  let uploadedText = "";
  let jdText = "";
  let generatedData = null;

  const TRIAL_LOCAL_KEY = "resume_tailor_trial_email";
  const MODEL_LOCAL_KEY = "gemini_model";
  const CLIENT_ID_KEY = "resume_tailor_client_id";

  const apiModal = document.getElementById("api-modal");
  const jdModal = document.getElementById("jd-modal");
  const resumeTextModal = document.getElementById("resume-text-modal");
  const placeholderModal = document.getElementById("placeholder-modal");
  const editModal = document.getElementById("edit-modal");
  const allModals = [apiModal, jdModal, resumeTextModal, placeholderModal, editModal].filter(Boolean);

  const modelSelect = document.getElementById("model-select");
  const jdInput = document.getElementById("jd-input");
  const resumeUpload = document.getElementById("resume-upload");
  const uploadLbl = document.getElementById("upload-resume-lbl");
  const sysStatus = document.getElementById("system-status");
  const trialStatus = document.getElementById("trial-status");
  const emailInput = document.getElementById("user-email");
  const previewSection = document.getElementById("preview-section");

  const generateBtn = document.getElementById("generate-btn");
  const btnText = document.getElementById("btn-text");
  const generateLoader = document.getElementById("generate-loader");

  const storedModel = localStorage.getItem(MODEL_LOCAL_KEY);
  if (storedModel && modelSelect) modelSelect.value = storedModel;

  const storedEmail = localStorage.getItem(TRIAL_LOCAL_KEY);
  if (storedEmail && emailInput) emailInput.value = storedEmail;

  const clientId = getOrCreateClientId();

  bindModalBasics();
  bindSettings();
  bindJd();
  bindResumeInputs();
  bindGeneration();
  bindDocumentEditing();
  bindThemeToggle();
  bindNavLinks();
  bindEscapeClose();

  if (emailInput) {
    emailInput.addEventListener("blur", refreshTrialStatus);
    emailInput.addEventListener("change", refreshTrialStatus);
  }

  refreshTrialStatus().catch(() => {
    if (trialStatus) trialStatus.textContent = "Free trial status unavailable";
  });

  function getOrCreateClientId() {
    const existing = localStorage.getItem(CLIENT_ID_KEY);
    if (existing) return existing;

    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(CLIENT_ID_KEY, id);
    return id;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setStatus(message, kind = "success") {
    if (!sysStatus) return;
    sysStatus.textContent = message || "";
    sysStatus.style.color = kind === "error" ? "#dc2626" : "#10B981";
  }

  function setBusy(busy) {
    btnText.style.display = busy ? "none" : "block";
    generateLoader.style.display = busy ? "block" : "none";
    generateBtn.disabled = busy;
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function openModal(modal) {
    if (!modal) return;
    modal.classList.remove("hidden");
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.add("hidden");
  }

  function closeAllModals() {
    allModals.forEach(closeModal);
  }

  function bindModalBasics() {
    allModals.forEach((modal) => {
      modal.addEventListener("click", (event) => {
        if (event.target === modal) {
          closeModal(modal);
        }
      });
    });
  }

  function bindEscapeClose() {
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      const openModals = allModals.filter((modal) => modal && !modal.classList.contains("hidden"));
      const top = openModals[openModals.length - 1];
      if (top) closeModal(top);
    });
  }

  function bindSettings() {
    document.getElementById("api-key-btn").addEventListener("click", () => openModal(apiModal));
    document.getElementById("close-api-btn").addEventListener("click", () => closeModal(apiModal));
    document.getElementById("save-api-btn").addEventListener("click", () => {
      if (modelSelect) localStorage.setItem(MODEL_LOCAL_KEY, modelSelect.value);
      closeModal(apiModal);
    });
  }

  function bindJd() {
    document.getElementById("open-jd-btn").addEventListener("click", () => {
      jdInput.value = jdText;
      openModal(jdModal);
    });

    document.getElementById("close-jd-btn").addEventListener("click", () => closeModal(jdModal));
    document.getElementById("save-jd-btn").addEventListener("click", () => {
      jdText = jdInput.value.trim();
      if (jdText) {
        const jdBtn = document.getElementById("open-jd-btn");
        jdBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> JD Saved';
        jdBtn.style.background = "var(--blue-50)";
      }
      closeModal(jdModal);
    });
  }

  function bindResumeInputs() {
    resumeUpload.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (file.type !== "application/pdf") {
        setStatus("Please upload a PDF file.", "error");
        return;
      }

      setStatus("Parsing PDF...");
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let fullText = "";
        const maxPages = Math.min(pdf.numPages, 20);
        for (let i = 1; i <= maxPages; i += 1) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item) => item.str).join(" ");
          fullText += `${pageText}\n`;
        }

        uploadedText = fullText.trim();
        uploadLbl.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> PDF Uploaded';
        uploadLbl.style.background = "var(--purple-50)";
        setStatus("PDF successfully extracted.");
      } catch (error) {
        setStatus("Failed to extract PDF text.", "error");
      }
    });

    const resumeTextInput = document.getElementById("resume-text-input");
    document.getElementById("open-resume-text-btn").addEventListener("click", () => {
      resumeTextInput.value = uploadedText;
      openModal(resumeTextModal);
    });
    document.getElementById("close-resume-text-btn").addEventListener("click", () => closeModal(resumeTextModal));
    document.getElementById("save-resume-text-btn").addEventListener("click", () => {
      const txt = resumeTextInput.value.trim();
      if (txt) {
        uploadedText = txt;
        uploadLbl.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Text Provided';
        uploadLbl.style.background = "var(--purple-50)";
      }
      closeModal(resumeTextModal);
    });
  }

  function withTimeout(ms = 60000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return {
      signal: controller.signal,
      clear: () => clearTimeout(timer)
    };
  }

  async function postJson(url, body, timeoutMs = 60000) {
    const timer = withTimeout(timeoutMs);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: timer.signal
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `Request failed (${response.status})`);
      }

      return payload;
    } finally {
      timer.clear();
    }
  }

  function requestIdentity() {
    const email = emailInput?.value.trim().toLowerCase() || "";
    if (email) localStorage.setItem(TRIAL_LOCAL_KEY, email);

    return {
      clientId,
      email
    };
  }

  async function refreshTrialStatus() {
    if (!trialStatus) return;

    const identity = requestIdentity();
    if (identity.email && !isValidEmail(identity.email)) {
      trialStatus.textContent = "Enter a valid email to track your free trials.";
      return;
    }

    const result = await postJson("/api/trial-status", identity, 10000);
    trialStatus.textContent = `${result.trialsRemaining}/${result.trialLimit} free full generations left`;
  }

  function bindGeneration() {
    generateBtn.addEventListener("click", async () => {
      const identity = requestIdentity();

      if (!identity.email || !isValidEmail(identity.email)) {
        setStatus("Enter a valid email to use free trials.", "error");
        return;
      }
      if (!jdText) {
        setStatus("Please paste the job description.", "error");
        return;
      }
      if (!uploadedText) {
        setStatus("Please upload or paste your resume text.", "error");
        return;
      }

      setStatus("Analyzing and tailoring your resume...");
      setBusy(true);

      try {
        const payload = await postJson("/api/generate", {
          ...identity,
          model: modelSelect?.value,
          resume: uploadedText,
          jd: jdText
        });

        generatedData = payload.data;
        renderPreview(generatedData);
        renderATSResume(generatedData);

        previewSection.style.display = "flex";
        previewSection.scrollIntoView({ behavior: "smooth" });

        setStatus("Tailored resume ready.");
        if (trialStatus) {
          trialStatus.textContent = `${payload.trialsRemaining}/${payload.trialLimit} free full generations left`;
        }
      } catch (error) {
        const message = error.name === "AbortError" ? "Request timed out. Please try again." : error.message;
        setStatus(message, "error");
      } finally {
        setBusy(false);
      }
    });
  }

  function highlightJDWords(plainText, jdSource) {
    const text = escapeHtml(plainText || "");
    if (!jdSource) return text;

    const stopWords = new Set(["and", "the", "to", "a", "of", "in", "for", "with", "on", "is", "as", "it", "by", "that", "this", "be", "are", "or", "an"]);
    const words = jdSource
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((word) => word.length > 3 && !stopWords.has(word));

    const uniqueWords = [...new Set(words)].sort((a, b) => b.length - a.length);

    let result = text;
    uniqueWords.forEach((word) => {
      const regex = new RegExp(`\\b(${word})\\b`, "gi");
      result = result.replace(regex, '<span class="highlight-jd">$1</span>');
    });
    return result;
  }

  async function rewriteSingleBullet(bulletText, jobTitle) {
    const identity = requestIdentity();
    const payload = await postJson("/api/rewrite-bullet", {
      ...identity,
      model: modelSelect?.value,
      bulletText,
      jdText,
      jobTitle
    });

    if (trialStatus) {
      trialStatus.textContent = `${payload.trialsRemaining}/${payload.trialLimit} free full generations left`;
    }

    return payload.bullet;
  }

  function renderPreview(data) {
    if (!data) return;

    document.getElementById("preview-name").textContent = data.name || "Candidate";

    const contactParts = [];
    if (data.contact && typeof data.contact === "object") {
      ["email", "phone", "location", "linkedin", "portfolio"].forEach((key) => {
        if (data.contact[key]) contactParts.push(escapeHtml(data.contact[key]));
      });
    }

    document.getElementById("preview-contact").innerHTML = contactParts.join(" &nbsp;|&nbsp; ");

    const summaryEl = document.getElementById("preview-summary");
    summaryEl.innerHTML = `<p style="font-size: 0.8rem; color: var(--text-main); margin-bottom: 0.5rem; line-height: 1.5;">${escapeHtml(data.summary || "")}</p>`;

    const skillsContainer = document.querySelector(".skills-badges");
    skillsContainer.innerHTML = (data.skills || [])
      .map((skill) => `<span class="badge">${highlightJDWords(skill, jdText)}</span>`)
      .join("");

    const expContainer = document.getElementById("preview-experience");
    if (expContainer && Array.isArray(data.experience)) {
      let html = '<div class="section-title" style="margin-top:1.5rem">EXPERIENCE</div>';
      data.experience.forEach((job, jIdx) => {
        html += `<div style="margin-bottom: 1.25rem;">
          <div style="font-weight:700; font-size:0.9rem;">${escapeHtml(job.title || "")} - ${escapeHtml(job.company || "")}</div>
          <div style="font-size:0.8rem; margin-bottom:8px; color:var(--text-muted);">${escapeHtml(job.dates || "")}</div>`;

        (job.bullets || []).forEach((bullet, bIdx) => {
          html += `<div class="bullet-row" data-jidx="${jIdx}" data-bidx="${bIdx}">
            <div style="font-size:0.85rem; flex:1; line-height:1.4;">• ${highlightJDWords(bullet, jdText)}</div>
            <button class="regen-btn" title="AI Rewrite Bullet" aria-label="Rewrite bullet">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9"/>
              </svg>
            </button>
          </div>`;
        });

        html += "</div>";
      });

      expContainer.innerHTML = html;

      document.querySelectorAll(".regen-btn").forEach((button) => {
        button.addEventListener("click", async (event) => {
          const row = event.currentTarget.closest(".bullet-row");
          const jIdx = Number(row.dataset.jidx);
          const bIdx = Number(row.dataset.bidx);
          const original = data.experience[jIdx].bullets[bIdx];

          event.currentTarget.innerHTML = '<span class="loader"></span>';
          event.currentTarget.disabled = true;

          try {
            const rewritten = await rewriteSingleBullet(original, data.experience[jIdx].title || "");
            data.experience[jIdx].bullets[bIdx] = rewritten;
            renderPreview(data);
            renderATSResume(data);
          } catch (error) {
            setStatus(error.message, "error");
            renderPreview(data);
          }
        });
      });
    }

    const beforeName = document.getElementById("before-name");
    if (beforeName) beforeName.textContent = data.name || "Candidate";

    const beforeContent = document.getElementById("before-content");
    if (beforeContent && uploadedText) beforeContent.textContent = uploadedText;

    if (data.metrics) {
      const score = Number(data.metrics.score || 85);
      const boundedScore = Number.isFinite(score) ? Math.max(1, Math.min(100, score)) : 85;

      const scoreEl = document.getElementById("dynamic-score");
      if (scoreEl) scoreEl.innerHTML = `${Math.round(boundedScore)}<span class="pct">%</span>`;

      const offset = 314 - (314 * boundedScore) / 100;
      const donut = document.getElementById("dynamic-donut");
      if (donut) donut.style.strokeDashoffset = offset;

      let label = "Strong Match";
      if (boundedScore >= 90) label = "Excellent Match";
      else if (boundedScore < 70) label = "Fair Match";

      const labelEl = document.getElementById("dynamic-label");
      if (labelEl) {
        labelEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="#7c3aed"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> ${label}`;
      }

      const impUl = document.getElementById("dynamic-improvements");
      if (impUl && Array.isArray(data.metrics.improvements)) {
        impUl.innerHTML = data.metrics.improvements.slice(0, 4).map((item) => `<li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> ${escapeHtml(item)}</li>`).join("");
      }
    }
  }

  function renderATSResume(data) {
    if (!data) return;

    const atsContainer = document.getElementById("ats-resume");
    const contactString = data.contact && typeof data.contact === "object"
      ? Object.values(data.contact).filter(Boolean).map(escapeHtml).join(" | ")
      : escapeHtml(data.contact || "");

    let html = `
      <h1>${escapeHtml(data.name || "Candidate")}</h1>
      <div class="contact-info">${contactString}</div>
      <h2>Professional Summary</h2>
      <p>${escapeHtml(data.summary || "")}</p>
      <h2>Core Competencies</h2>
      <p style="line-height:1.5;">${(data.skills || []).map(escapeHtml).join(" • ")}</p>
      <h2>Experience</h2>
    `;

    (data.experience || []).forEach((job) => {
      html += `
        <div style="margin-bottom: 12px;">
          <div class="xp-header"><span>${escapeHtml(job.title || "")}</span><span>${escapeHtml(job.dates || "")}</span></div>
          <div class="xp-subheader"><span>${escapeHtml(job.company || "")}</span><span>${escapeHtml(job.location || "")}</span></div>
          <ul>${(job.bullets || []).map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>
        </div>
      `;
    });

    if (Array.isArray(data.projects) && data.projects.length > 0) {
      html += "<h2>Projects</h2>";
      data.projects.forEach((project) => {
        const description = project.description ? `${project.description} - ` : "";
        const bullets = Array.isArray(project.bullets) ? project.bullets.join(". ") : "";
        html += `<div style="margin-bottom: 8px;"><span style="font-weight: bold;">${escapeHtml(project.name || "")}:</span> <span>${escapeHtml(description + bullets)}</span></div>`;
      });
    }

    if (Array.isArray(data.awards) && data.awards.length > 0) {
      html += `<h2>Honors & Awards</h2><p style="line-height:1.6; margin-bottom: 8px;">${data.awards.map(escapeHtml).join(" &nbsp;•&nbsp; ")}</p>`;
    }

    if (Array.isArray(data.education) && data.education.length > 0) {
      html += "<h2>Education</h2>";
      data.education.forEach((entry) => {
        html += `<div style="margin-bottom: 6px;"><div class="xp-header"><span>${escapeHtml(entry.degree || "")}</span><span>${escapeHtml(entry.dates || "")}</span></div><div class="xp-subheader"><span>${escapeHtml(entry.school || "")}</span><span></span></div></div>`;
      });
    }

    atsContainer.innerHTML = html;
  }

  function bindDocumentEditing() {
    const editableContainer = document.getElementById("editable-ats-container");
    const atsContainer = document.getElementById("ats-resume");

    document.getElementById("download-trigger").addEventListener("click", () => {
      document.title = generatedData?.name ? `${generatedData.name.replace(/\s+/g, "_")}_Tailored` : "Tailored_Resume";
      window.print();
      setTimeout(() => {
        document.title = "ResumeTailor AI";
      }, 1000);
    });

    document.getElementById("edit-trigger").addEventListener("click", () => {
      if (!atsContainer.innerHTML.trim()) return;
      editableContainer.innerHTML = atsContainer.innerHTML;
      openModal(editModal);
    });

    document.getElementById("close-edit-btn").addEventListener("click", () => closeModal(editModal));
    document.getElementById("save-edit-btn").addEventListener("click", () => {
      atsContainer.innerHTML = editableContainer.innerHTML;
      closeModal(editModal);
    });
  }

  function bindThemeToggle() {
    const themeBtn = document.getElementById("theme-toggle-btn");
    if (!themeBtn) return;

    themeBtn.addEventListener("click", () => {
      document.body.classList.toggle("dark-mode");
      const isDark = document.body.classList.contains("dark-mode");
      localStorage.setItem("resume_tailor_theme", isDark ? "dark" : "light");
    });

    if (localStorage.getItem("resume_tailor_theme") === "dark") {
      document.body.classList.add("dark-mode");
    }
  }

  function bindNavLinks() {
    const placeholderTitle = document.getElementById("placeholder-title");
    const placeholderText = document.getElementById("placeholder-text");

    document.getElementById("close-placeholder-btn").addEventListener("click", () => closeModal(placeholderModal));

    document.getElementById("nav-how").addEventListener("click", (event) => {
      event.preventDefault();
      document.querySelector(".steps-card").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    document.getElementById("nav-feats").addEventListener("click", (event) => {
      event.preventDefault();
      document.querySelector(".features-row").scrollIntoView({ behavior: "smooth", block: "center" });
    });

    document.getElementById("nav-price").addEventListener("click", (event) => {
      event.preventDefault();
      placeholderTitle.textContent = "Pricing";
      placeholderText.innerHTML = "<strong>Beta plan:</strong> each user gets 6 free full resume generations. Paid plans unlock higher monthly limits and team access.";
      openModal(placeholderModal);
    });

    document.getElementById("nav-faq").addEventListener("click", (event) => {
      event.preventDefault();
      placeholderTitle.textContent = "FAQ";
      placeholderText.innerHTML = "<strong>How are limits enforced?</strong><br>Rate-limiting and trial tracking run on the backend API so browser-side tampering does not grant extra usage.";
      openModal(placeholderModal);
    });
  }

  closeAllModals();
});
