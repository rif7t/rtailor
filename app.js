document.addEventListener('DOMContentLoaded', () => {
    let apiKey = localStorage.getItem('gemini_api_key') || '';
    let uploadedText = "";
    let jdText = "";
    let generatedData = null;

    // Modals
    const apiModal = document.getElementById('api-modal');
    const jdModal = document.getElementById('jd-modal');
    const apiKeyInput = document.getElementById('api-key');
    const modelSelect = document.getElementById('model-select');
    const jdInput = document.getElementById('jd-input');

    if(apiKey) apiKeyInput.value = apiKey;
    let storedModel = localStorage.getItem('gemini_model');
    if(storedModel && modelSelect) modelSelect.value = storedModel;

    // API Key bindings
    document.getElementById('api-key-btn').addEventListener('click', () => apiModal.classList.remove('hidden'));
    document.getElementById('close-api-btn').addEventListener('click', () => apiModal.classList.add('hidden'));
    document.getElementById('save-api-btn').addEventListener('click', () => {
        apiKey = apiKeyInput.value.trim();
        if(apiKey) localStorage.setItem('gemini_api_key', apiKey);
        if(modelSelect) localStorage.setItem('gemini_model', modelSelect.value);
        apiModal.classList.add('hidden');
    });

    // JD bindings
    document.getElementById('open-jd-btn').addEventListener('click', () => {
        jdInput.value = jdText;
        jdModal.classList.remove('hidden');
    });
    document.getElementById('close-jd-btn').addEventListener('click', () => jdModal.classList.add('hidden'));
    document.getElementById('save-jd-btn').addEventListener('click', () => {
        jdText = jdInput.value.trim();
        if(jdText){
            document.getElementById('open-jd-btn').innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> JD Saved`;
            document.getElementById('open-jd-btn').style.background = 'var(--blue-50)';
        }
        jdModal.classList.add('hidden');
    });

    // File Upload bindings
    const resumeUpload = document.getElementById('resume-upload');
    const uploadLbl = document.getElementById('upload-resume-lbl');
    const sysStatus = document.getElementById('system-status');

    resumeUpload.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            if (file.type !== "application/pdf") {
                sysStatus.textContent = "Error: Please upload a PDF file.";
                sysStatus.style.color = 'red';
                return;
            }
            sysStatus.textContent = "Parsing PDF...";
            sysStatus.style.color = '#10B981';
            
            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                let fullText = "";
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(" ");
                    fullText += pageText + "\n";
                }
                
                uploadedText = fullText.trim();
                uploadLbl.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> PDF Uploaded`;
                uploadLbl.style.background = 'var(--purple-50)';
                sysStatus.textContent = "PDF successfully extracted!";
                setTimeout(() => sysStatus.textContent = "", 3000);
            } catch (err) {
                sysStatus.textContent = "Failed to extract PDF text.";
                sysStatus.style.color = 'red';
            }
        }
    });

    // Generate
    const generateBtn = document.getElementById('generate-btn');
    const btnText = document.getElementById('btn-text');
    const generateLoader = document.getElementById('generate-loader');
    const previewSection = document.getElementById('preview-section');

    generateBtn.addEventListener('click', async () => {
        if (!apiKey) {
            apiModal.classList.remove('hidden');
            return;
        }
        if (!jdText) {
            sysStatus.textContent = "Please paste the Job Description.";
            sysStatus.style.color = 'red';
            return;
        }
        if (!uploadedText) {
            sysStatus.textContent = "Please upload a resume.";
            sysStatus.style.color = 'red';
            return;
        }

        sysStatus.textContent = "Analyzing matched skills...";
        sysStatus.style.color = '#10B981';
        btnText.style.display = 'none';
        generateLoader.style.display = 'block';
        generateBtn.disabled = true;

        try {
            generatedData = await callGeminiAPI(apiKey, uploadedText, jdText);
            sysStatus.textContent = "";
            renderPreview(generatedData);
            renderATSResume(generatedData);
            previewSection.style.display = 'flex';
            // Scroll to preview
            previewSection.scrollIntoView({ behavior: 'smooth' });
        } catch (err) {
            sysStatus.textContent = err.message;
            sysStatus.style.color = 'red';
        } finally {
            btnText.style.display = 'block';
            generateLoader.style.display = 'none';
            generateBtn.disabled = false;
        }
    });

    async function callGeminiAPI(apiKey, resume, jd) {
        let currentModel = 'gemini-1.5-flash';
        const ms = document.getElementById('model-select');
        if(ms) currentModel = ms.value;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;
        const prompt = `
        You are an elite ATS resume optimization expert. Your task is to perfectly tailor the candidate's existing resume to the provided job description so it easily passes ATS screening.
        IMPORTANT: Do NOT invent or add contact details (like LinkedIn) if they are missing from the original resume. 
        CRITICAL CONTENT STRATEGY & RANKING:
        1. Ranking & Prioritization: Scrutinize the ENTIRE original resume. Absolutely prioritize and rank ANY project, experience, or feature that scores highly against the JD requirements. Ensure high-scoring matching content is fiercely protected and sorted to the top of all arrays.
        2. Impact & Contributions: Rewrite experience bullet points to explicitly highlight the candidate's direct impact. Use strong action verbs and integrate quantifiable metrics/results into the bullets wherever possible.
        3. Strict 1-Page Comprehensiveness: You MUST fit the final output onto a single page. Strongly favor JD-matching content first, then tightly summarize remaining original content to maintain a full resume feel without spilling over page bounds.
        4. Stealth Mode (Humanize): Strictly AVOID classic AI buzzwords (e.g., 'Spearheaded', 'Pioneered', 'Leveraged', 'Delved', 'Navigated', 'Fostered'). Compulsorily use simple, grounded action verbs so the text reads organically and humanly.
        Return raw valid JSON ONLY, using this schema:
        {
          "metrics": {
            "score": "integer 1-100 indicating honest math score of how well they match the JD",
            "improvements": ["String list of 3-4 specific brief changes you made"]
          },
          "name": "Full Name",
          "contact": {
            "location": "City, State (if present)",
            "phone": "Phone (if present)",
            "email": "Email (if present)",
            "linkedin": "LinkedIn (if present)",
            "portfolio": "Portfolio/Website (if present)"
          },
          "summary": "Professional summary...",
          "skills": ["Skill 1", "Skill 2"],
          "experience": [
            {
              "title": "Job Title",
              "company": "Company Name",
              "dates": "Start - End",
              "location": "City, State",
              "bullets": ["Action verb + context + result", "..."]
            }
          ],
          "projects": [
            {
              "name": "Project Name",
              "description": "Short description (optional)",
              "bullets": ["Strictly inline context and outcomes", "..."]
            }
          ],
          "awards": ["Award 1 (Date)", "Award 2 (Date)"],
          "education": [{"degree": "Degree (Include GPA/Grade if present)", "school": "Institution", "dates": "Date"}]
        }
        --- PAST RESUME TEXT ---
        ${resume}
        --- TARGET JOB DESCRIPTION ---
        ${jd}
        `;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2 }
            })
        });

        if (!response.ok) {
            let errMsg = "API Connection Failed";
            if (response.status === 400) errMsg = "Oops! Something went wrong with the input data. Please check your text.";
            else if (response.status === 403) errMsg = "Invalid API Key. Please click the Settings icon and enter a valid Google Gemini API Key.";
            else if (response.status === 404) errMsg = "Model not supported. Please open Settings and select a different AI Model.";
            else if (response.status === 429) errMsg = "API Quota Exceeded. You have hit your usage limits. Please select a different model in Settings or try again later.";
            else if (response.status >= 500) errMsg = "Google's AI servers are currently busy. Please try again in a few moments.";
            else errMsg = `HTTP Error ${response.status}: Please try again.`;
            
            throw new Error(errMsg);
        }

        const data = await response.json();
        let cleanText = data.candidates[0].content.parts[0].text.trim();
        if (cleanText.startsWith('```json')) cleanText = cleanText.substring(7);
        if (cleanText.startsWith('```')) cleanText = cleanText.substring(3);
        if (cleanText.endsWith('```')) cleanText = cleanText.substring(0, cleanText.length - 3);

        return JSON.parse(cleanText);
    }

    function highlightJDWords(text, jdText) {
        if (!jdText) return text;
        const stopWords = ['and','the','to','a','of','in','for','with','on','is','as','it','by','that','this','be','are','or','an'];
        const words = jdText.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3 && !stopWords.includes(w));
        const uniqueWords = [...new Set(words)];
        
        uniqueWords.sort((a,b) => b.length - a.length);
        
        let result = text;
        uniqueWords.forEach(word => {
            const regex = new RegExp(`\\b(${word})\\b`, 'gi');
            result = result.replace(regex, '<span class="highlight-jd">$1</span>');
        });
        return result;
    }

    async function generateSingleBullet(bulletText, jdText, jobTitle) {
        let apiKey = document.getElementById('api-key').value.trim();
        if(!apiKey) apiKey = getInternalKey();
        const currentModel = document.getElementById('model-select').value;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;
        
        const prompt = `You are an ATS resume editor. Rewrite the following single bullet point to be more impactful and strictly aligned with the Context Job Description.
        Keep it strictly to one single sentence. Stealth Mode (Humanize): AVOID classic AI buzzwords (Spearheaded, Pioneered, Leveraged, Navigated). Use simple, grounded writing.
        Do not output JSON. ONLY return the rewritten bullet string.
        Job Context: ${jobTitle}
        Job Description: ${jdText.substring(0, 1000)}
        Original Bullet: ${bulletText}`;

        const requestBody = { contents: [{ parts: [{ text: prompt }] }] };
        const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody) });
        
        if (!response.ok) throw new Error("API Connection Failed");
        const resData = await response.json();
        let text = resData.candidates[0].content.parts[0].text;
        return text.replace(/^["*•-]\s*/g, '').trim(); 
    }

    function renderPreview(data) {
        if (!data) return;
        document.getElementById('preview-name').textContent = data.name || 'Candidate';
        
        let contactHtml = '';
        if(data.contact && typeof data.contact === 'object') {
            if(data.contact.location) contactHtml += `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> ${data.contact.location}&nbsp;&nbsp;`;
            if(data.contact.email) contactHtml += `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> ${data.contact.email}&nbsp;&nbsp;`;
            if(data.contact.phone) contactHtml += `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20 M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> ${data.contact.phone}&nbsp;&nbsp;`;
        }
        document.getElementById('preview-contact').innerHTML = contactHtml;
        
        const uploadedJDText = document.getElementById('jd-input').value;

        const mockText = document.getElementById('preview-summary');
        if(mockText) mockText.innerHTML = `<p style="font-size: 0.8rem; color: var(--text-main); margin-bottom: 0.5rem; line-height: 1.5;">${data.summary || ''}</p>`;
        
        const skillsContainer = document.querySelector('.skills-badges');
        if(skillsContainer) {
            skillsContainer.innerHTML = (data.skills || []).map(s => `<span class="badge">${highlightJDWords(s, uploadedJDText)}</span>`).join('');
        }

        const expContainer = document.getElementById('preview-experience');
        if (expContainer && data.experience) {
            let xpHTML = `<div class="section-title" style="margin-top:1.5rem">EXPERIENCE</div>`;
            data.experience.forEach((job, jIdx) => {
                xpHTML += `
                <div style="margin-bottom: 1.25rem;">
                    <div style="font-weight:700; font-size:0.9rem;">${job.title} - ${job.company}</div>
                    <div style="font-size:0.8rem; margin-bottom:8px; color:var(--text-muted);">${job.dates || ''}</div>`;
                (job.bullets || []).forEach((b, bIdx) => {
                    const highlighted = highlightJDWords(b, uploadedJDText);
                    xpHTML += `
                    <div class="bullet-row" data-jidx="${jIdx}" data-bidx="${bIdx}">
                        <div style="font-size:0.85rem; flex:1; line-height:1.4;">• ${highlighted}</div>
                        <button class="regen-btn" title="AI Rewrite Bullet">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9"/>
                            </svg>
                        </button>
                    </div>`;
                });
                xpHTML += `</div>`;
            });
            expContainer.innerHTML = xpHTML;
            
            document.querySelectorAll('.regen-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const btnEl = e.currentTarget;
                    const row = btnEl.closest('.bullet-row');
                    const jIdx = row.dataset.jidx;
                    const bIdx = row.dataset.bidx;
                    const origText = data.experience[jIdx].bullets[bIdx];
                    
                    btnEl.innerHTML = `<span class="loader"></span>`;
                    btnEl.disabled = true;
                    try {
                        const newBullet = await generateSingleBullet(origText, uploadedJDText, data.experience[jIdx].title);
                        data.experience[jIdx].bullets[bIdx] = newBullet;
                        renderPreview(data);
                        renderATSResume(data);
                    } catch(err) {
                        alert("Update failed: " + err.message);
                        renderPreview(data);
                    }
                });
            });
        }

        const beforeName = document.getElementById('before-name');
        if (beforeName) beforeName.textContent = data.name || 'Candidate';
        const beforeContent = document.getElementById('before-content');
        if (beforeContent && uploadedText) beforeContent.innerHTML = uploadedText;

        if (data.metrics) {
             const score = data.metrics.score || 85;
             const scoreEl = document.getElementById('dynamic-score');
             if (scoreEl) scoreEl.innerHTML = `${score}<span class="pct">%</span>`;
             const offset = 314 - (314 * score / 100);
             const donut = document.getElementById('dynamic-donut');
             if (donut) donut.style.strokeDashoffset = offset;
             let label = 'Strong Match';
             if (score >= 90) label = 'Excellent Match';
             else if (score < 70) label = 'Fair Match';
             const labelEl = document.getElementById('dynamic-label');
             if (labelEl) labelEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="#7c3aed"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> ${label}`;
             const impUl = document.getElementById('dynamic-improvements');
             if (impUl && data.metrics.improvements && Array.isArray(data.metrics.improvements)) {
                 impUl.innerHTML = data.metrics.improvements.slice(0, 4).map(imp => 
                     `<li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> ${imp}</li>`
                 ).join('');
             }
        }
    }

    function renderATSResume(data) {
        if (!data) return;
        const atsContainer = document.getElementById('ats-resume');
        
        let contactString = '';
        if(data.contact && typeof data.contact === 'object') {
             contactString = Object.values(data.contact).filter(Boolean).join(' | ');
        } else if (typeof data.contact === 'string') {
             contactString = data.contact;
        }

        let html = `
            <h1>${data.name || 'Candidate'}</h1>
            <div class="contact-info">${contactString}</div>
            <h2>Professional Summary</h2>
            <p>${data.summary || ''}</p>
            <h2>Core Competencies</h2>
            <p style="line-height:1.5;">${(data.skills || []).join(' • ')}</p>
            <h2>Experience</h2>
        `;
        (data. अनुभव || data.experience || []).forEach(job => {
            html += `
                <div style="margin-bottom: 12px;">
                    <div class="xp-header"><span>${job.title || ''}</span><span>${job.dates || ''}</span></div>
                    <div class="xp-subheader"><span>${job.company || ''}</span><span>${job.location || ''}</span></div>
                    <ul>${(job.bullets || []).map(b => `<li>${b}</li>`).join('')}</ul>
                </div>
            `;
        });
        
        if (data.projects && data.projects.length > 0) {
            html += `<h2>Projects</h2>`;
            data.projects.forEach(proj => {
                let pText = proj.description || '';
                if(proj.bullets && proj.bullets.length > 0) {
                     pText = (proj.description ? proj.description + ' - ' : '') + proj.bullets.join('. ');
                }
                html += `
                <div style="margin-bottom: 8px;">
                    <span style="font-weight: bold;">${proj.name || ''}:</span> <span>${pText}</span>
                </div>`;
            });
        }

        if (data.awards && data.awards.length > 0) {
            html += `<h2>Honors & Awards</h2><p style="line-height:1.6; margin-bottom: 8px;">${data.awards.join(' &nbsp;•&nbsp; ')}</p>`;
        }

        if (data.education && data.education.length > 0) {
            html += `<h2>Education</h2>`;
            data.education.forEach(e => {
                html += `<div style="margin-bottom: 6px;">
                    <div class="xp-header"><span>${e.degree || ''}</span><span>${e.dates || ''}</span></div>
                    <div class="xp-subheader"><span>${e.school || ''}</span><span></span></div>
                </div>`;
            });
        }
        
        atsContainer.innerHTML = html;
    }

    // Download PDF binding
    document.getElementById('download-trigger').addEventListener('click', () => {
        document.title = generatedData?.name ? `${generatedData.name.replace(/\s+/g, '_')}_Tailored` : "Tailored_Resume";
        window.print();
        setTimeout(() => document.title = "ResumeTailor AI", 1000);
    });

    // Edit Document binding
    const editModal = document.getElementById('edit-modal');
    const editableContainer = document.getElementById('editable-ats-container');
    const atsContainer = document.getElementById('ats-resume');

    document.getElementById('edit-trigger').addEventListener('click', () => {
        if (!atsContainer.innerHTML.trim()) return;
        editableContainer.innerHTML = atsContainer.innerHTML;
        editModal.classList.remove('hidden');
    });

    document.getElementById('close-edit-btn').addEventListener('click', () => editModal.classList.add('hidden'));

    document.getElementById('save-edit-btn').addEventListener('click', () => {
        atsContainer.innerHTML = editableContainer.innerHTML;
        editModal.classList.add('hidden');
    });

    // Theme Toggle Binding
    const themeBtn = document.getElementById('theme-toggle-btn');
    if(themeBtn) {
        themeBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('resume_tailor_theme', isDark ? 'dark' : 'light');
        });
        
        // Load default preference
        if (localStorage.getItem('resume_tailor_theme') === 'dark') {
            document.body.classList.add('dark-mode');
        }
    }

    // --- NEW LOGIC IMPORTS ---
    // Resume Paste Text modal
    const resumeTextModal = document.getElementById('resume-text-modal');
    const resumeTextInput = document.getElementById('resume-text-input');
    
    document.getElementById('open-resume-text-btn').addEventListener('click', () => {
        resumeTextInput.value = uploadedText;
        resumeTextModal.classList.remove('hidden');
    });
    document.getElementById('close-resume-text-btn').addEventListener('click', () => resumeTextModal.classList.add('hidden'));
    document.getElementById('save-resume-text-btn').addEventListener('click', () => {
        const txt = resumeTextInput.value.trim();
        if(txt) {
            uploadedText = txt;
            document.getElementById('upload-resume-lbl').innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Text Provided`;
            document.getElementById('upload-resume-lbl').style.background = 'var(--purple-50)';
        }
        resumeTextModal.classList.add('hidden');
    });

    // Nav Links Placeholders
    const placeholderModal = document.getElementById('placeholder-modal');
    const placeholderTitle = document.getElementById('placeholder-title');
    const placeholderText = document.getElementById('placeholder-text');
    
    document.getElementById('close-placeholder-btn').addEventListener('click', () => placeholderModal.classList.add('hidden'));
    
    document.getElementById('nav-how').addEventListener('click', (e) => { e.preventDefault(); document.querySelector('.steps-card').scrollIntoView({behavior: 'smooth', block: 'start'}); });
    document.getElementById('nav-feats').addEventListener('click', (e) => { e.preventDefault(); document.querySelector('.features-row').scrollIntoView({behavior: 'smooth', block: 'center'}); });
    document.getElementById('nav-price').addEventListener('click', (e) => {
        e.preventDefault();
        placeholderTitle.textContent = "Pricing";
        placeholderText.innerHTML = "<strong>ResumeTailor AI is currently in free Beta!</strong><br><br>While we evaluate API costs, the entire platform is completely free to use as long as you provide your own Gemini API key.";
        placeholderModal.classList.remove('hidden');
    });
    document.getElementById('nav-faq').addEventListener('click', (e) => {
        e.preventDefault();
        placeholderTitle.textContent = "FAQ";
        placeholderText.innerHTML = "<strong>How do you guarantee ATS success?</strong><br>We don't use canvas screenshots. We render a pure, stripped-down native HTML file and trigger Print-to-PDF which preserves 100% textbook character encoding.";
        placeholderModal.classList.remove('hidden');
    });
});
