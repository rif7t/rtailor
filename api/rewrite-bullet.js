const { buildIdentifier, checkRateLimit, getRemainingTrials, FREE_TRIAL_LIMIT } = require("./_lib/limits");
const { geminiRequest, pickModel, stripCodeFence } = require("./_lib/gemini");

function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const body = req.body || {};
  const bulletText = typeof body.bulletText === "string" ? body.bulletText.trim() : "";
  const jdText = typeof body.jdText === "string" ? body.jdText.trim() : "";
  const jobTitle = typeof body.jobTitle === "string" ? body.jobTitle.trim() : "";

  if (!bulletText || !jdText) {
    return json(res, 400, { error: "bulletText and jdText are required." });
  }

  const identifier = buildIdentifier(req, body);

  try {
    const rate = await checkRateLimit(identifier, "rewrite");
    if (rate.limited) {
      return json(res, 429, {
        error: "Too many rewrite requests. Please wait a few minutes.",
        retryAfterSeconds: rate.retryAfterSeconds
      });
    }

    const prompt = `You are an ATS resume editor. Rewrite exactly one bullet point to be more impactful and aligned with the job description.
Keep it to one sentence.
Avoid obvious AI buzzwords such as Spearheaded, Pioneered, Leveraged, Navigated.
Return plain text only (no JSON, no markdown list symbols).
Job Context: ${jobTitle}
Job Description: ${jdText.slice(0, 1300)}
Original Bullet: ${bulletText}`;

    const response = await geminiRequest({
      model: pickModel(body.model),
      prompt,
      temperature: 0.3
    });

    const text = stripCodeFence(response.text).replace(/^['"*•\-\s]+/, "").trim();
    const remaining = await getRemainingTrials(identifier);

    return json(res, 200, {
      bullet: text,
      model: response.model,
      trialsRemaining: remaining,
      trialLimit: FREE_TRIAL_LIMIT
    });
  } catch (error) {
    if (error.status) {
      return json(res, 502, { error: "Language model request failed." });
    }
    return json(res, 500, { error: error.message || "Unexpected server error." });
  }
};
