const ALLOWED_MODELS = new Set([
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash-8b-latest",
  "gemini-1.5-pro-latest",
  "gemma-3-27b-it"
]);

function getApiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("Server is missing GEMINI_API_KEY environment variable.");
  }
  return key;
}

function pickModel(requestedModel) {
  if (requestedModel && ALLOWED_MODELS.has(requestedModel)) {
    return requestedModel;
  }
  return "gemma-3-27b-it";
}

function stripCodeFence(text) {
  let cleaned = text.trim();

  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }

  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }

  return cleaned.trim();
}

async function geminiRequest({ model, prompt, temperature = 0.2 }) {
  const apiKey = getApiKey();
  const targetModel = pickModel(model);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature }
    })
  });

  if (!response.ok) {
    const payload = await response.text();
    const error = new Error(`Gemini API error ${response.status}: ${payload}`);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return {
    model: targetModel,
    text: String(text)
  };
}

function normalizeResumePayload(parsed) {
  const fallback = {
    metrics: {
      score: null,
      baselineScore: null,
      optimizedScore: null,
      fitSummary: "",
      requiredAdditions: [],
      improvements: ["Improved role alignment", "Strengthened impact wording"]
    },
    name: "Candidate",
    contact: {},
    summary: "",
    skills: [],
    experience: [],
    projects: [],
    awards: [],
    education: []
  };

  if (!parsed || typeof parsed !== "object") {
    return fallback;
  }

  const merged = {
    ...fallback,
    ...parsed,
    metrics: {
      ...fallback.metrics,
      ...(typeof parsed.metrics === "object" && parsed.metrics ? parsed.metrics : {})
    }
  };

  if (!Array.isArray(merged.metrics.improvements)) merged.metrics.improvements = fallback.metrics.improvements;
  if (!Array.isArray(merged.metrics.requiredAdditions)) merged.metrics.requiredAdditions = [];
  if (typeof merged.metrics.fitSummary !== "string") merged.metrics.fitSummary = "";
  if (!Array.isArray(merged.skills)) merged.skills = [];
  if (!Array.isArray(merged.experience)) merged.experience = [];
  if (!Array.isArray(merged.projects)) merged.projects = [];
  if (!Array.isArray(merged.awards)) merged.awards = [];
  if (!Array.isArray(merged.education)) merged.education = [];
  if (!merged.contact || typeof merged.contact !== "object") merged.contact = {};

  const numericScore = Number(merged.metrics.score);
  const baselineScore = Number(merged.metrics.baselineScore);
  const optimizedScore = Number(merged.metrics.optimizedScore);
  merged.metrics.score = Number.isFinite(numericScore) ? Math.max(1, Math.min(100, Math.round(numericScore))) : null;
  merged.metrics.baselineScore = Number.isFinite(baselineScore) ? Math.max(1, Math.min(100, Math.round(baselineScore))) : null;
  merged.metrics.optimizedScore = Number.isFinite(optimizedScore) ? Math.max(1, Math.min(100, Math.round(optimizedScore))) : null;

  return merged;
}

function parseResumeJson(rawText) {
  const stripped = stripCodeFence(rawText);
  let parsed;
  try {
    parsed = JSON.parse(stripped);
  } catch (error) {
    throw new Error("Model response was not valid JSON.");
  }

  return normalizeResumePayload(parsed);
}

module.exports = {
  ALLOWED_MODELS,
  pickModel,
  stripCodeFence,
  geminiRequest,
  parseResumeJson
};
