import pg from "pg";
import { z } from "zod";

const { Pool } = pg;

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL environment variable is not set. " +
          "Set it to a PostgreSQL connection string, e.g. postgresql://user:pass@host:5432/dbname"
      );
    }
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      statement_timeout: 30_000,
    });
  }
  return pool;
}

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

export const PgQueryInput = z.object({
  query: z
    .string()
    .describe("A read-only SQL query (SELECT, EXPLAIN, SHOW, WITH ... SELECT)"),
  params: z
    .array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional()
    .describe("Optional parameterized query values ($1, $2, ...)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(5000)
    .optional()
    .default(100)
    .describe("Maximum rows to return (default 100, max 5000)"),
});

export const PgSchemaInput = z.object({
  table: z
    .string()
    .describe("Table name (optionally schema-qualified, e.g. public.users)"),
});

export const PgTablesInput = z.object({
  schema: z
    .string()
    .optional()
    .default("public")
    .describe("Schema name (default: public)"),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FORBIDDEN_PATTERN =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|COPY|CALL)\b/i;

function assertReadOnly(sql: string): void {
  // Strip comments, string literals, and dollar-quoted strings to prevent bypass
  const stripped = sql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/\$\$[\s\S]*?\$\$/g, "''");
  if (FORBIDDEN_PATTERN.test(stripped)) {
    throw new Error(
      "Only read-only queries are allowed (SELECT, EXPLAIN, SHOW, WITH ... SELECT). " +
        "Mutation statements are blocked for safety."
    );
  }
  // Check for mutation keywords inside WITH/CTE blocks
  const cteMatch = stripped.match(/\bWITH\b([\s\S]*?)\bSELECT\b/i);
  if (cteMatch && FORBIDDEN_PATTERN.test(cteMatch[1])) {
    throw new Error(
      "Mutation statements inside WITH/CTE blocks are not allowed. " +
        "Only read-only queries are permitted."
    );
  }
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

export async function pgQuery(
  input: z.infer<typeof PgQueryInput>
): Promise<string> {
  assertReadOnly(input.query);

  const client = await getPool().connect();
  try {
    await client.query("BEGIN READ ONLY");

    let sql = input.query.trim().replace(/;+$/, "");

    // Inject LIMIT if not already present and the query is a plain SELECT
    const hasLimit = /\bLIMIT\b/i.test(sql);
    if (!hasLimit && /^\s*(SELECT|WITH)\b/i.test(sql)) {
      sql = `${sql} LIMIT ${input.limit ?? 100}`;
    }

    const result = await client.query(sql, input.params ?? []);
    await client.query("COMMIT");

    const rowCount = result.rowCount ?? result.rows.length;
    const output: Record<string, unknown> = {
      columns: result.fields.map((f) => f.name),
      rows: result.rows,
      rowCount,
    };
    return JSON.stringify(output, null, 2);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function pgSchema(
  input: z.infer<typeof PgSchemaInput>
): Promise<string> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN READ ONLY");

    const parts = input.table.split(".");
    const schemaName = parts.length > 1 ? parts[0] : "public";
    const tableName = parts.length > 1 ? parts[1] : parts[0];

    // Columns
    const columnsResult = await client.query(
      `SELECT column_name, data_type, is_nullable, column_default,
              character_maximum_length, numeric_precision, numeric_scale
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2
       ORDER BY ordinal_position`,
      [schemaName, tableName]
    );

    // Primary key
    const pkResult = await client.query(
      `SELECT kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
       WHERE tc.constraint_type = 'PRIMARY KEY'
         AND tc.table_schema = $1
         AND tc.table_name = $2
       ORDER BY kcu.ordinal_position`,
      [schemaName, tableName]
    );

    // Foreign keys
    const fkResult = await client.query(
      `SELECT
         kcu.column_name,
         ccu.table_schema AS foreign_schema,
         ccu.table_name AS foreign_table,
         ccu.column_name AS foreign_column,
         tc.constraint_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name
         AND ccu.table_schema = tc.table_schema
       WHERE tc.constraint_type = 'FOREIGN KEY'
         AND tc.table_schema = $1
         AND tc.table_name = $2`,
      [schemaName, tableName]
    );

    // Indexes
    const indexResult = await client.query(
      `SELECT indexname, indexdef
       FROM pg_indexes
       WHERE schemaname = $1 AND tablename = $2
       ORDER BY indexname`,
      [schemaName, tableName]
    );

    await client.query("COMMIT");

    const output = {
      table: `${schemaName}.${tableName}`,
      columns: columnsResult.rows,
      primaryKey: pkResult.rows.map((r) => r.column_name),
      foreignKeys: fkResult.rows,
      indexes: indexResult.rows,
    };
    return JSON.stringify(output, null, 2);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function pgTables(
  input: z.infer<typeof PgTablesInput>
): Promise<string> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN READ ONLY");

    const result = await client.query(
      `SELECT
         t.table_name,
         t.table_type,
         pg_stat.n_live_tup AS estimated_row_count,
         pg_size_pretty(pg_total_relation_size(quote_ident(t.table_schema) || '.' || quote_ident(t.table_name))) AS total_size,
         pg_size_pretty(pg_relation_size(quote_ident(t.table_schema) || '.' || quote_ident(t.table_name))) AS data_size,
         obj_description((quote_ident(t.table_schema) || '.' || quote_ident(t.table_name))::regclass) AS comment
       FROM information_schema.tables t
       LEFT JOIN pg_stat_user_tables pg_stat
         ON pg_stat.schemaname = t.table_schema
         AND pg_stat.relname = t.table_name
       WHERE t.table_schema = $1
       ORDER BY t.table_name`,
      [input.schema]
    );

    await client.query("COMMIT");

    return JSON.stringify(
      { schema: input.schema, tables: result.rows },
      null,
      2
    );
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function shutdownPostgres(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
