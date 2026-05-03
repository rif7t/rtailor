const crypto = require("crypto");
const { getValue, incrementValue, getTtl } = require("./store");

const FREE_TRIAL_LIMIT = 6;
const RATE_LIMIT_REQUESTS = 3;
const RATE_LIMIT_WINDOW_SECONDS = 10 * 60;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length) {
    return forwarded.split(",")[0].trim();
  }

  return req.socket?.remoteAddress || "unknown";
}

function buildIdentifier(req, body) {
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const clientId = typeof body?.clientId === "string" ? body.clientId.trim() : "";
  const ip = normalizeIp(req);
  const fingerprint = email || clientId || "anon";
  return sha256(`${fingerprint}|${ip}`);
}

async function checkRateLimit(identifier, action) {
  const key = `rl:${action}:${identifier}`;
  const count = await incrementValue(key, RATE_LIMIT_WINDOW_SECONDS);
  const ttl = await getTtl(key);

  if (count > RATE_LIMIT_REQUESTS) {
    return {
      limited: true,
      retryAfterSeconds: ttl > 0 ? ttl : RATE_LIMIT_WINDOW_SECONDS,
      count
    };
  }

  return {
    limited: false,
    retryAfterSeconds: ttl > 0 ? ttl : RATE_LIMIT_WINDOW_SECONDS,
    count
  };
}

async function getRemainingTrials(identifier) {
  const key = `trial:${identifier}`;
  const used = Number(await getValue(key) || 0);
  return Math.max(0, FREE_TRIAL_LIMIT - used);
}

async function consumeTrial(identifier) {
  const key = `trial:${identifier}`;
  const used = Number(await getValue(key) || 0);

  if (used >= FREE_TRIAL_LIMIT) {
    return {
      allowed: false,
      used,
      remaining: 0,
      limit: FREE_TRIAL_LIMIT
    };
  }

  const nextUsed = await incrementValue(key);
  return {
    allowed: true,
    used: nextUsed,
    remaining: Math.max(0, FREE_TRIAL_LIMIT - nextUsed),
    limit: FREE_TRIAL_LIMIT
  };
}

module.exports = {
  FREE_TRIAL_LIMIT,
  RATE_LIMIT_REQUESTS,
  RATE_LIMIT_WINDOW_SECONDS,
  buildIdentifier,
  checkRateLimit,
  getRemainingTrials,
  consumeTrial
};
