const { buildIdentifier, getRemainingTrials, FREE_TRIAL_LIMIT } = require("./_lib/limits");

function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const identifier = buildIdentifier(req, body);
    const remaining = await getRemainingTrials(identifier);

    return json(res, 200, {
      trialsRemaining: remaining,
      trialLimit: FREE_TRIAL_LIMIT
    });
  } catch (error) {
    return json(res, 500, { error: error.message || "Unexpected server error." });
  }
};
