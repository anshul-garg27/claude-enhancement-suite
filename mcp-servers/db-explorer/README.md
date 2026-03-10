# db-explorer MCP Server

A read-only MCP server for exploring PostgreSQL, MongoDB, and Redis databases. All operations are strictly read-only -- no mutations are possible.

## Features

### PostgreSQL
- **pg_query** - Run read-only SQL queries (SELECT, EXPLAIN, SHOW, WITH...SELECT) inside READ ONLY transactions
- **pg_schema** - Inspect table schemas: columns, types, primary keys, foreign keys, indexes
- **pg_tables** - List all tables with estimated row counts and sizes

### MongoDB
- **mongo_query** - Run find queries with filter, projection, sort, and limit (secondaryPreferred read preference)
- **mongo_collections** - List collections with estimated document counts
- **mongo_schema** - Infer collection schema by sampling documents

### Redis
- **redis_get** - Retrieve values for any key type (string, hash, list, set, sorted set)
- **redis_keys** - Scan keys matching a glob pattern (uses SCAN, not KEYS)
- **redis_info** - Get server info with parsed highlights (memory, clients, keyspace)

## Security

- PostgreSQL queries run inside `BEGIN READ ONLY` transactions
- Mutation keywords (INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, etc.) are blocked at the application level
- MongoDB uses `secondaryPreferred` read preference
- Redis client is instantiated with `readOnly: true`
- No write operations are exposed through any tool

## Setup

### Prerequisites
- Node.js 18+
- Access to one or more of: PostgreSQL, MongoDB, Redis

### Install
```bash
cd db-explorer
npm install
```

### Environment Variables
Set the connection strings for the databases you want to use. You only need to set the ones you plan to query -- tools for unconfigured databases will return a helpful error.

```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/mydb"
export MONGODB_URL="mongodb://localhost:27017/mydb"
export REDIS_URL="redis://localhost:6379"
```

### Run (development)
```bash
npx tsx src/index.ts
```

### Build and run (production)
```bash
npm run build
node dist/index.js
```

## Claude Desktop / Claude Code Configuration

Add this to your `claude_desktop_config.json` or `.claude/settings.json`:

```json
{
  "mcpServers": {
    "db-explorer": {
      "command": "node",
      "args": ["/absolute/path/to/db-explorer/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://user:password@localhost:5432/mydb",
        "MONGODB_URL": "mongodb://localhost:27017/mydb",
        "REDIS_URL": "redis://localhost:6379"
      }
    }
  }
}
```

For development with tsx:
```json
{
  "mcpServers": {
    "db-explorer": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/db-explorer/src/index.ts"],
      "env": {
        "DATABASE_URL": "postgresql://user:password@localhost:5432/mydb",
        "MONGODB_URL": "mongodb://localhost:27017/mydb",
        "REDIS_URL": "redis://localhost:6379"
      }
    }
  }
}
```
