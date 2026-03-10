import { MongoClient, ReadPreference } from "mongodb";
import { z } from "zod";

let client: MongoClient | null = null;

function getClient(): MongoClient {
  if (!client) {
    const url = process.env.MONGODB_URL;
    if (!url) {
      throw new Error(
        "MONGODB_URL environment variable is not set. " +
          "Set it to a MongoDB connection string, e.g. mongodb://localhost:27017/mydb"
      );
    }
    client = new MongoClient(url, {
      readPreference: ReadPreference.SECONDARY_PREFERRED,
      serverSelectionTimeoutMS: 10_000,
      connectTimeoutMS: 10_000,
    });
  }
  return client;
}

function extractDbName(): string {
  const url = process.env.MONGODB_URL ?? "";
  const match = url.match(/\/([^/?]+)(\?|$)/);
  if (match) return match[1];
  throw new Error(
    "Could not extract database name from MONGODB_URL. " +
      "Include the database name in the connection string, e.g. mongodb://host:27017/mydb"
  );
}

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

export const MongoQueryInput = z.object({
  collection: z.string().describe("Collection name"),
  filter: z
    .string()
    .optional()
    .default("{}")
    .describe('JSON filter document, e.g. {"status": "active"}'),
  projection: z
    .string()
    .optional()
    .describe('JSON projection document, e.g. {"name": 1, "email": 1}'),
  sort: z
    .string()
    .optional()
    .describe('JSON sort document, e.g. {"createdAt": -1}'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .default(50)
    .describe("Maximum documents to return (default 50, max 1000)"),
});

export const MongoCollectionsInput = z.object({
  database: z
    .string()
    .optional()
    .describe("Database name (defaults to the one in MONGODB_URL)"),
});

export const MongoSchemaInput = z.object({
  collection: z.string().describe("Collection name"),
  sampleSize: z
    .number()
    .int()
    .min(1)
    .max(500)
    .optional()
    .default(100)
    .describe("Number of documents to sample for schema inference (default 100)"),
  database: z
    .string()
    .optional()
    .describe("Database name (defaults to the one in MONGODB_URL)"),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeJsonParse(raw: string, label: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(
      `Invalid JSON for ${label}: ${raw}. Provide a valid JSON object.`
    );
  }
}

const BLOCKED_OPERATORS = ['$where', '$function', '$accumulator', '$merge', '$out'];

function sanitizeFilter(filter: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(filter)) {
    if (BLOCKED_OPERATORS.includes(key)) {
      throw new Error(`Operator '${key}' is blocked for security. Only read-safe operators are allowed.`);
    }
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitizeFilter(value as Record<string, unknown>);
    }
  }
}

type SchemaField = {
  types: Set<string>;
  count: number;
  sample: unknown;
  children?: Map<string, SchemaField>;
};

function inferFieldType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (value instanceof Date) return "date";
  const t = typeof value;
  if (t === "object") {
    const proto = Object.prototype.toString.call(value);
    if (proto === "[object Date]") return "date";
    if (proto === "[object RegExp]") return "regex";
    return "object";
  }
  return t;
}

function mergeIntoSchema(
  schema: Map<string, SchemaField>,
  doc: Record<string, unknown>,
  prefix: string = ""
): void {
  for (const [key, value] of Object.entries(doc)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    let field = schema.get(fullKey);
    if (!field) {
      field = { types: new Set(), count: 0, sample: undefined, children: undefined };
      schema.set(fullKey, field);
    }
    const ft = inferFieldType(value);
    field.types.add(ft);
    field.count++;
    if (field.sample === undefined && value !== null && value !== undefined) {
      field.sample = value;
    }
    if (ft === "object" && value !== null && typeof value === "object" && !Array.isArray(value)) {
      if (!field.children) field.children = new Map();
      mergeIntoSchema(field.children, value as Record<string, unknown>, fullKey);
    }
  }
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

export async function mongoQuery(
  input: z.infer<typeof MongoQueryInput>
): Promise<string> {
  const mc = getClient();
  await mc.connect();

  const dbName = extractDbName();
  const db = mc.db(dbName);
  const collection = db.collection(input.collection);

  const filter = safeJsonParse(input.filter ?? "{}", "filter");
  sanitizeFilter(filter);
  const projection = input.projection
    ? safeJsonParse(input.projection, "projection")
    : undefined;
  const sort = input.sort
    ? safeJsonParse(input.sort, "sort")
    : undefined;

  let cursor = collection.find(filter);
  if (projection) cursor = cursor.project(projection);
  if (sort) cursor = cursor.sort(sort as Record<string, 1 | -1>);
  cursor = cursor.limit(input.limit ?? 50);

  const docs = await cursor.toArray();

  return JSON.stringify(
    {
      collection: input.collection,
      database: dbName,
      count: docs.length,
      documents: docs,
    },
    null,
    2
  );
}

export async function mongoCollections(
  input: z.infer<typeof MongoCollectionsInput>
): Promise<string> {
  const mc = getClient();
  await mc.connect();

  const dbName = input.database ?? extractDbName();
  const db = mc.db(dbName);

  const collections = await db.listCollections().toArray();

  const results = await Promise.all(
    collections.map(async (col) => {
      const stats = await db
        .collection(col.name)
        .estimatedDocumentCount()
        .catch(() => -1);
      return {
        name: col.name,
        type: col.type,
        estimatedDocumentCount: stats,
      };
    })
  );

  results.sort((a, b) => a.name.localeCompare(b.name));

  return JSON.stringify({ database: dbName, collections: results }, null, 2);
}

export async function mongoSchema(
  input: z.infer<typeof MongoSchemaInput>
): Promise<string> {
  const mc = getClient();
  await mc.connect();

  const dbName = input.database ?? extractDbName();
  const db = mc.db(dbName);
  const collection = db.collection(input.collection);

  const sampleSize = input.sampleSize ?? 100;
  const docs = await collection.find({}).limit(sampleSize).toArray();

  if (docs.length === 0) {
    return JSON.stringify({
      collection: input.collection,
      database: dbName,
      documentsSampled: 0,
      schema: {},
      message: "Collection is empty, no schema could be inferred.",
    });
  }

  const schema = new Map<string, SchemaField>();
  for (const doc of docs) {
    mergeIntoSchema(schema, doc as Record<string, unknown>);
  }

  const schemaOutput: Record<string, unknown> = {};
  for (const [key, field] of schema) {
    const types = Array.from(field.types);
    let sampleValue = field.sample;
    // Truncate long strings
    if (typeof sampleValue === "string" && sampleValue.length > 200) {
      sampleValue = sampleValue.slice(0, 200) + "...";
    }
    schemaOutput[key] = {
      types,
      frequency: `${field.count}/${docs.length}`,
      percentPresent: Math.round((field.count / docs.length) * 100),
      sample: sampleValue,
    };
  }

  return JSON.stringify(
    {
      collection: input.collection,
      database: dbName,
      documentsSampled: docs.length,
      fieldCount: schema.size,
      schema: schemaOutput,
    },
    null,
    2
  );
}

export async function shutdownMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
  }
}
