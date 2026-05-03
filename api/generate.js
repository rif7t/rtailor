const { buildIdentifier, checkRateLimit, consumeTrial } = require("./_lib/limits");
const { geminiRequest, parseResumeJson, pickModel } = require("./_lib/gemini");

function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(payload));
}

function badRequest(res, message) {
  return json(res, 400, { error: message });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const body = req.body || {};
  const resume = typeof body.resume === "string" ? body.resume.trim() : "";
  const jd = typeof body.jd === "string" ? body.jd.trim() : "";

  if (!resume) return badRequest(res, "Resume text is required.");
  if (!jd) return badRequest(res, "Job description is required.");

  const identifier = buildIdentifier(req, body);

  try {
    const rate = await checkRateLimit(identifier, "generate");
    if (rate.limited) {
      return json(res, 429, {
        error: "Too many requests. Please wait a few minutes.",
        retryAfterSeconds: rate.retryAfterSeconds
      });
    }

    const trial = await consumeTrial(identifier);
    if (!trial.allowed) {
      return json(res, 402, {
        error: "Free trial limit reached. Upgrade to continue.",
        trialsRemaining: trial.remaining,
        trialLimit: trial.limit
      });
    }

    const prompt = `
You are an elite ATS resume optimization expert. Your task is to tailor the candidate's existing resume to the provided job description so it passes ATS screening.
IMPORTANT: Do not invent contact details that are missing from the original resume.
IMPORTANT: Keep claims realistic. Do not fabricate jobs, companies, certifications, or fake quantified achievements.
For missing JD requirements, add natural and specific improvement content where possible using existing evidence, and clearly surface what is still missing.
Strictly keep the final resume to one page worth of concise content.
Avoid obvious AI buzzwords such as Spearheaded, Pioneered, Leveraged, Delved, Navigated, Fostered.
Scoring rules:
- baselineScore = fit of original resume text vs JD (realistic)
- optimizedScore = fit after your tailoring (realistic, usually improved but not magically high)
- score = optimizedScore (integer 1-100)
Return raw valid JSON only, with this schema:
{
  "metrics": {
    "score": "integer 1-100 optimized fit score",
    "baselineScore": "integer 1-100 baseline fit before tailoring",
    "optimizedScore": "integer 1-100 fit after tailoring",
    "fitSummary": "1-2 sentence realistic assessment of current fit after tailoring",
    "requiredAdditions": ["Specific missing requirements still needed for a stronger fit"],
    "improvements": ["Specific brief changes made in resume content"]
  },
  "name": "Full Name",
  "contact": {
    "location": "City, State (if present)",
    "phone": "Phone (if present)",
    "email": "Email (if present)",
    "linkedin": "LinkedIn (if present)",
    "portfolio": "Portfolio/Website (if present)"
  },
  "summary": "Professional summary",
  "skills": ["Skill 1", "Skill 2"],
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "dates": "Start - End",
      "location": "City, State",
      "bullets": ["Action + context + outcome", "..."]
    }
  ],
  "projects": [{"name": "Project", "description": "Optional", "bullets": ["..."]}],
  "awards": ["Award 1"],
  "education": [{"degree": "Degree", "school": "Institution", "dates": "Date"}]
}
--- PAST RESUME TEXT ---
${resume}
--- TARGET JOB DESCRIPTION ---
${jd}
`;

    const response = await geminiRequest({
      model: pickModel(body.model),
      prompt,
      temperature: 0.2
    });

    const parsed = parseResumeJson(response.text);

    return json(res, 200, {
      data: parsed,
      model: response.model,
      trialsRemaining: trial.remaining,
      trialLimit: trial.limit
    });
  } catch (error) {
    if (error.status) {
      return json(res, 502, { error: "Language model request failed." });
    }
    return json(res, 500, { error: error.message || "Unexpected server error." });
  }
};
