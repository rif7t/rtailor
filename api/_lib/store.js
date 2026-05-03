const memoryStore = globalThis.__resumeTailorStore || new Map();
if (!globalThis.__resumeTailorStore) {
  globalThis.__resumeTailorStore = memoryStore;
}

function getRedisConfig() {
  const baseUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!baseUrl || !token) {
    return null;
  }

  return { baseUrl, token };
}

async function redisCommand(command, ...args) {
  const cfg = getRedisConfig();
  if (!cfg) {
    return null;
  }

  const path = [command, ...args].map((segment) => encodeURIComponent(String(segment))).join("/");
  const url = `${cfg.baseUrl}/${path}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Redis command failed (${command}): ${response.status} ${body}`);
  }

  const payload = await response.json();
  return payload.result;
}

function gcMemoryStore() {
  const now = Date.now();
  for (const [key, value] of memoryStore.entries()) {
    if (value.expiresAt && value.expiresAt <= now) {
      memoryStore.delete(key);
    }
  }
}

function getMemoryValue(key) {
  gcMemoryStore();
  const entry = memoryStore.get(key);
  return entry ? entry.value : null;
}

function setMemoryValue(key, value, ttlSeconds) {
  const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
  memoryStore.set(key, { value, expiresAt });
}

async function getValue(key) {
  const cfg = getRedisConfig();
  if (!cfg) {
    return getMemoryValue(key);
  }

  return redisCommand("get", key);
}

async function incrementValue(key, ttlSeconds) {
  const cfg = getRedisConfig();
  if (!cfg) {
    const current = Number(getMemoryValue(key) || 0) + 1;
    setMemoryValue(key, current, ttlSeconds);
    return current;
  }

  const next = Number(await redisCommand("incr", key) || 0);
  if (ttlSeconds && next === 1) {
    await redisCommand("expire", key, ttlSeconds);
  }
  return next;
}

async function getTtl(key) {
  const cfg = getRedisConfig();
  if (!cfg) {
    gcMemoryStore();
    const entry = memoryStore.get(key);
    if (!entry || !entry.expiresAt) {
      return -1;
    }
    return Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 1000));
  }

  return Number(await redisCommand("ttl", key));
}

module.exports = {
  getRedisConfig,
  getValue,
  incrementValue,
  getTtl
};
