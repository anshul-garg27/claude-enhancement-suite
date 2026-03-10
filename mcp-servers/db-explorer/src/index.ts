import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  PgQueryInput,
  PgSchemaInput,
  PgTablesInput,
  pgQuery,
  pgSchema,
  pgTables,
  shutdownPostgres,
} from "./tools/postgres.js";

import {
  MongoQueryInput,
  MongoCollectionsInput,
  MongoSchemaInput,
  mongoQuery,
  mongoCollections,
  mongoSchema,
  shutdownMongo,
} from "./tools/mongodb.js";

import {
  RedisGetInput,
  RedisKeysInput,
  RedisInfoInput,
  redisGet,
  redisKeys,
  redisInfo,
  shutdownRedis,
} from "./tools/redis.js";

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "db-explorer",
  version: "1.0.0",
});

// ---------------------------------------------------------------------------
// PostgreSQL tools
// ---------------------------------------------------------------------------

server.tool(
  "pg_query",
  "Run a read-only SQL query against PostgreSQL. Only SELECT, EXPLAIN, SHOW, and WITH...SELECT are allowed. " +
    "The query runs inside a READ ONLY transaction. Results are automatically limited.",
  PgQueryInput.shape,
  async (input) => {
    try {
      const result = await pgQuery(PgQueryInput.parse(input));
      return { content: [{ type: "text", text: result }] };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `PostgreSQL query error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "pg_schema",
  "Get the full schema of a PostgreSQL table including columns, data types, nullability, " +
    "defaults, primary key, foreign keys, and indexes.",
  PgSchemaInput.shape,
  async (input) => {
    try {
      const result = await pgSchema(PgSchemaInput.parse(input));
      return { content: [{ type: "text", text: result }] };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `PostgreSQL schema error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "pg_tables",
  "List all tables in a PostgreSQL schema with estimated row counts, data size, " +
    "and total size (including indexes).",
  PgTablesInput.shape,
  async (input) => {
    try {
      const result = await pgTables(PgTablesInput.parse(input));
      return { content: [{ type: "text", text: result }] };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `PostgreSQL tables error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// MongoDB tools
// ---------------------------------------------------------------------------

server.tool(
  "mongo_query",
  "Run a read-only find query against a MongoDB collection. Supports filter, projection, sort, and limit. " +
    "Uses secondaryPreferred read preference.",
  MongoQueryInput.shape,
  async (input) => {
    try {
      const result = await mongoQuery(MongoQueryInput.parse(input));
      return { content: [{ type: "text", text: result }] };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `MongoDB query error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "mongo_collections",
  "List all collections in a MongoDB database with estimated document counts.",
  MongoCollectionsInput.shape,
  async (input) => {
    try {
      const result = await mongoCollections(MongoCollectionsInput.parse(input));
      return { content: [{ type: "text", text: result }] };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `MongoDB collections error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "mongo_schema",
  "Infer the schema of a MongoDB collection by sampling documents. " +
    "Returns field names, types, frequency, and sample values.",
  MongoSchemaInput.shape,
  async (input) => {
    try {
      const result = await mongoSchema(MongoSchemaInput.parse(input));
      return { content: [{ type: "text", text: result }] };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `MongoDB schema error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Redis tools
// ---------------------------------------------------------------------------

server.tool(
  "redis_get",
  "Get the value of a Redis key. Supports all common types: string, hash, list, set, sorted set. " +
    "Automatically detects key type or accepts a type hint.",
  RedisGetInput.shape,
  async (input) => {
    try {
      const result = await redisGet(RedisGetInput.parse(input));
      return { content: [{ type: "text", text: result }] };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Redis get error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "redis_keys",
  "List Redis keys matching a glob pattern. Uses SCAN (not KEYS) for production safety. " +
    "Returns key names, types, and TTLs. Supports cursor-based pagination.",
  RedisKeysInput.shape,
  async (input) => {
    try {
      const result = await redisKeys(RedisKeysInput.parse(input));
      return { content: [{ type: "text", text: result }] };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Redis keys error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "redis_info",
  "Get Redis server information. Returns parsed server info with highlights " +
    "(memory usage, connected clients, total keys, uptime, version).",
  RedisInfoInput.shape,
  async (input) => {
    try {
      const result = await redisInfo(RedisInfoInput.parse(input));
      return { content: [{ type: "text", text: result }] };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Redis info error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

async function shutdown(): Promise<void> {
  console.error("[db-explorer] Shutting down...");
  await Promise.allSettled([shutdownPostgres(), shutdownMongo(), shutdownRedis()]);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[db-explorer] MCP server running on stdio");
}

main().catch((err) => {
  console.error("[db-explorer] Fatal error:", err);
  process.exit(1);
});
