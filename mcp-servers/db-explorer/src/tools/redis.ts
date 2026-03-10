import Redis from "ioredis";
import { z } from "zod";

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new Error(
        "REDIS_URL environment variable is not set. " +
          "Set it to a Redis connection string, e.g. redis://localhost:6379"
      );
    }
    redis = new Redis(url, {
      connectTimeout: 10_000,
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      readOnly: true,
    });
  }
  return redis;
}

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

export const RedisGetInput = z.object({
  key: z.string().describe("The Redis key to retrieve"),
  type: z
    .enum(["auto", "string", "hash", "list", "set", "zset"])
    .optional()
    .default("auto")
    .describe(
      'Key type. Use "auto" to detect automatically (default). ' +
        "Supported: string, hash, list, set, zset."
    ),
});

export const RedisKeysInput = z.object({
  pattern: z
    .string()
    .describe('Glob pattern for key matching, e.g. "user:*" or "cache:session:*"'),
  count: z
    .number()
    .int()
    .min(1)
    .max(10000)
    .optional()
    .default(100)
    .describe("Maximum number of keys to return (default 100, max 10000)"),
  cursor: z
    .string()
    .optional()
    .default("0")
    .describe("Cursor for pagination (default: 0, meaning start from beginning)"),
});

export const RedisInfoInput = z.object({
  section: z
    .enum([
      "all",
      "server",
      "clients",
      "memory",
      "stats",
      "replication",
      "cpu",
      "keyspace",
    ])
    .optional()
    .default("all")
    .describe("Info section to retrieve (default: all)"),
});

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

export async function redisGet(
  input: z.infer<typeof RedisGetInput>
): Promise<string> {
  const r = getRedis();
  await r.connect().catch(() => {}); // no-op if already connected

  let keyType = input.type ?? "auto";
  if (keyType === "auto") {
    keyType = (await r.type(input.key)) as typeof keyType;
    if (keyType === ("none" as string)) {
      return JSON.stringify({
        key: input.key,
        exists: false,
        message: "Key does not exist.",
      });
    }
  }

  const ttl = await r.ttl(input.key);
  const encoding = await r.object("ENCODING", input.key).catch(() => "unknown");

  let value: unknown;
  switch (keyType) {
    case "string":
      value = await r.get(input.key);
      // Try to parse JSON strings for readability
      if (typeof value === "string") {
        try {
          value = JSON.parse(value);
        } catch {
          // keep as string
        }
      }
      break;
    case "hash":
      value = await r.hgetall(input.key);
      break;
    case "list": {
      const len = await r.llen(input.key);
      const cap = Math.min(len, 500);
      value = {
        totalLength: len,
        items: await r.lrange(input.key, 0, cap - 1),
        truncated: len > cap,
      };
      break;
    }
    case "set": {
      const members = await r.smembers(input.key);
      value = {
        cardinality: members.length,
        members: members.slice(0, 500),
        truncated: members.length > 500,
      };
      break;
    }
    case "zset": {
      const card = await r.zcard(input.key);
      const cap = Math.min(card, 500);
      const raw = await r.zrange(input.key, 0, cap - 1, "WITHSCORES");
      const pairs: Array<{ member: string; score: string }> = [];
      for (let i = 0; i < raw.length; i += 2) {
        pairs.push({ member: raw[i], score: raw[i + 1] });
      }
      value = { cardinality: card, members: pairs, truncated: card > cap };
      break;
    }
    default:
      value = `Unsupported type: ${keyType}`;
  }

  return JSON.stringify(
    {
      key: input.key,
      type: keyType,
      encoding,
      ttl: ttl === -1 ? "no expiry" : ttl === -2 ? "key missing" : `${ttl}s`,
      value,
    },
    null,
    2
  );
}

export async function redisKeys(
  input: z.infer<typeof RedisKeysInput>
): Promise<string> {
  const r = getRedis();
  await r.connect().catch(() => {});

  const maxKeys = input.count ?? 100;
  const collected: string[] = [];
  let cursor = input.cursor ?? "0";
  let iterations = 0;
  const maxIterations = 1000; // safety valve

  do {
    const [nextCursor, keys] = await r.scan(
      cursor,
      "MATCH",
      input.pattern,
      "COUNT",
      200
    );
    cursor = nextCursor;
    for (const k of keys) {
      collected.push(k);
      if (collected.length >= maxKeys) break;
    }
    iterations++;
  } while (cursor !== "0" && collected.length < maxKeys && iterations < maxIterations);

  // For each key, get the type (up to what we collected)
  const detailed = await Promise.all(
    collected.slice(0, maxKeys).map(async (key) => {
      const type = await r.type(key);
      const ttl = await r.ttl(key);
      return {
        key,
        type,
        ttl: ttl === -1 ? "no expiry" : ttl === -2 ? "missing" : `${ttl}s`,
      };
    })
  );

  return JSON.stringify(
    {
      pattern: input.pattern,
      matchedCount: detailed.length,
      nextCursor: cursor === "0" ? null : cursor,
      hasMore: cursor !== "0",
      keys: detailed,
    },
    null,
    2
  );
}

export async function redisInfo(
  input: z.infer<typeof RedisInfoInput>
): Promise<string> {
  const r = getRedis();
  await r.connect().catch(() => {});

  const section = input.section ?? "all";
  const raw = section === "all" ? await r.info() : await r.info(section);

  // Parse the INFO output into structured data
  const sections: Record<string, Record<string, string>> = {};
  let currentSection = "default";

  for (const line of raw.split("\r\n")) {
    if (line.startsWith("#")) {
      currentSection = line.replace(/^#\s*/, "").trim();
      sections[currentSection] = {};
    } else if (line.includes(":")) {
      const idx = line.indexOf(":");
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      if (!sections[currentSection]) sections[currentSection] = {};
      sections[currentSection][key] = val;
    }
  }

  // Extract some computed highlights
  const highlights: Record<string, string | number> = {};
  const mem = sections["Memory"];
  if (mem) {
    highlights.usedMemoryHuman = mem["used_memory_human"] ?? "unknown";
    highlights.peakMemoryHuman = mem["used_memory_peak_human"] ?? "unknown";
  }
  const clients = sections["Clients"];
  if (clients) {
    highlights.connectedClients = parseInt(clients["connected_clients"] ?? "0", 10);
  }
  const keyspace = sections["Keyspace"];
  if (keyspace) {
    let totalKeys = 0;
    for (const val of Object.values(keyspace)) {
      const m = val.match(/keys=(\d+)/);
      if (m) totalKeys += parseInt(m[1], 10);
    }
    highlights.totalKeys = totalKeys;
  }
  const server = sections["Server"];
  if (server) {
    highlights.redisVersion = server["redis_version"] ?? "unknown";
    highlights.uptimeDays = Math.floor(
      parseInt(server["uptime_in_seconds"] ?? "0", 10) / 86400
    );
  }

  return JSON.stringify(
    { section, highlights, details: sections },
    null,
    2
  );
}

export async function shutdownRedis(): Promise<void> {
  if (redis) {
    redis.disconnect();
    redis = null;
  }
}
