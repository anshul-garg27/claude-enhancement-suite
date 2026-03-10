---
name: migrate-db
description: Create and manage database migrations safely with rollback support
user-invocable: true
argument-hint: "Migration description, e.g. 'add user_roles table' or 'add index on orders.created_at'"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
---

# Database Migration Skill

You are a database migration specialist. Given a migration description, detect the project's migration framework, generate safe UP and DOWN migrations, and validate them for common pitfalls.

## Input

The user provides a description of the database change they need. Examples:
- "add user_roles table"
- "add index on orders.created_at"
- "add email_verified column to users"
- "rename column full_name to display_name in profiles"
- "create junction table for many-to-many users-to-teams"

## Process

### Step 1: Detect the Migration Framework

Search the project to identify which migration tool is in use:

```
# Drizzle ORM
Look for: drizzle.config.ts, drizzle/, src/db/schema.ts, package.json with "drizzle-kit"

# Prisma
Look for: prisma/schema.prisma, prisma/migrations/

# Alembic (Python/SQLAlchemy)
Look for: alembic.ini, alembic/, migrations/versions/

# Flyway (Java)
Look for: flyway.conf, src/main/resources/db/migration/, V*__*.sql

# Django
Look for: manage.py, */migrations/, django in requirements

# Knex.js
Look for: knexfile.js, knexfile.ts, migrations/

# golang-migrate
Look for: migrate/, *.up.sql / *.down.sql pairs

# TypeORM
Look for: ormconfig.ts, src/migrations/, typeorm in package.json

# Raw SQL
Look for: migrations/ directory with .sql files, sqlc.yaml
```

If multiple frameworks are detected, ask the user which one to use.

### Step 2: Understand the Current Schema

Read the existing schema to understand:
- Current table structure
- Existing indexes and constraints
- Foreign key relationships
- Existing data types and conventions

For Prisma: Read `prisma/schema.prisma`
For Drizzle: Read the schema files (usually `src/db/schema.ts` or `src/db/schema/`)
For Alembic: Check the latest migration and models
For raw SQL: Check the migration files in order, or query the database if available

### Step 3: Generate the Migration

#### Drizzle ORM (TypeScript)

1. Update the schema file(s) in `src/db/schema.ts` or equivalent
2. Run `npx drizzle-kit generate` to create the migration SQL
3. Review the generated migration

Schema example:
```typescript
import { pgTable, serial, text, timestamp, integer, index, uniqueIndex } from "drizzle-orm/pg-core";

export const userRoles = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("user_roles_user_id_idx").on(table.userId),
  uniqueUserRole: uniqueIndex("user_roles_unique").on(table.userId, table.role),
}));
```

#### Prisma

1. Update `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name MIGRATION_NAME --create-only` to generate
3. Review the generated SQL in `prisma/migrations/`

Schema example:
```prisma
model UserRole {
  id        Int      @id @default(autoincrement())
  userId    Int      @map("user_id")
  role      String
  createdAt DateTime @default(now()) @map("created_at")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, role])
  @@index([userId])
  @@map("user_roles")
}
```

#### Alembic (Python)

Generate migration:
```bash
alembic revision --autogenerate -m "MIGRATION_DESCRIPTION"
```

Or create manually:
```python
"""add user_roles table

Revision ID: xxxx
Revises: yyyy
Create Date: 2024-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "xxxx"
down_revision = "yyyy"

def upgrade() -> None:
    op.create_table(
        "user_roles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "role", name="uq_user_roles_user_role"),
    )
    op.create_index("ix_user_roles_user_id", "user_roles", ["user_id"])

def downgrade() -> None:
    op.drop_index("ix_user_roles_user_id")
    op.drop_table("user_roles")
```

#### Flyway (Java)

Create `V{VERSION}__{description}.sql`:
```sql
-- V003__add_user_roles_table.sql

CREATE TABLE user_roles (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        VARCHAR(50) NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_roles_user_role UNIQUE (user_id, role)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
```

And the undo file `U003__add_user_roles_table.sql`:
```sql
DROP TABLE IF EXISTS user_roles;
```

#### Raw SQL / golang-migrate

Create paired files:
- `{TIMESTAMP}_add_user_roles.up.sql`
- `{TIMESTAMP}_add_user_roles.down.sql`

UP:
```sql
BEGIN;

CREATE TABLE user_roles (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        VARCHAR(50) NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_roles_user_role UNIQUE (user_id, role)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);

COMMIT;
```

DOWN:
```sql
BEGIN;

DROP TABLE IF EXISTS user_roles;

COMMIT;
```

#### sqlc Regeneration

If the project uses `sqlc`, after creating raw SQL migrations:
1. Check for `sqlc.yaml` or `sqlc.json`
2. Update query files if new tables need queries
3. Run `sqlc generate` to regenerate Go code

### Step 4: Validate Migration Safety

Run through this checklist and WARN the user about any issues:

#### Data Loss Risks
- [ ] **Dropping a column**: Will lose data. Suggest: rename to `_deprecated` first, drop after confirming no reads.
- [ ] **Dropping a table**: Will lose all data. Ensure backups exist.
- [ ] **Changing column type**: May fail if data can't be cast. Suggest: add new column, migrate data, drop old.
- [ ] **Adding NOT NULL without default**: Will fail if table has existing rows. Always provide a DEFAULT.
- [ ] **Removing a UNIQUE constraint**: May allow duplicate data going forward.

#### Lock Risks (PostgreSQL-specific)
- [ ] **ALTER TABLE ... ADD COLUMN with DEFAULT (< PG 11)**: Takes ACCESS EXCLUSIVE lock, rewrites table. On PG 11+, this is fast.
- [ ] **CREATE INDEX**: Locks writes. Use `CREATE INDEX CONCURRENTLY` instead.
- [ ] **ALTER TABLE ... ALTER COLUMN TYPE**: Rewrites entire table. Extremely slow on large tables.
- [ ] **ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY**: Scans entire table. Use `NOT VALID` then `VALIDATE CONSTRAINT` separately.
- [ ] **RENAME TABLE/COLUMN**: Instant but breaks application code that references the old name. Deploy code changes first.

#### Safe Migration Patterns
- **Adding a nullable column**: Always safe, instant.
- **Adding a column with DEFAULT (PG 11+)**: Safe, instant.
- **Creating an index concurrently**: Safe, non-blocking.
- **Adding a table**: Always safe.
- **Backfilling data**: Do in batches to avoid long transactions.

### Step 5: Generate DOWN Migration

ALWAYS generate a DOWN/rollback migration that:
1. Reverses the UP migration exactly
2. Can be run without data loss where possible
3. Handles the case where the UP migration was partially applied

If a perfect rollback is impossible (e.g., dropped column can't restore data), document this clearly in a comment.

### Step 6: Naming Convention

Follow the project's existing naming convention. If none exists, use:

- **Timestamp-based**: `20240115120000_add_user_roles.sql`
- **Sequential**: `0042_add_user_roles.sql`
- **Descriptive**: verb + subject: `add_`, `create_`, `alter_`, `drop_`, `rename_`, `add_index_`

### Step 7: Summarize and Advise

After generating the migration, provide:

1. **What was generated**: List of files created/modified
2. **Safety assessment**: Any warnings from the validation step
3. **Deployment steps**: Commands to run the migration
4. **Rollback steps**: Commands to roll back if something goes wrong
5. **Testing suggestion**: How to verify the migration works (e.g., run on a test database first)

## Output

1. Migration file(s) - both UP and DOWN
2. Schema file updates (if using an ORM like Prisma/Drizzle)
3. Safety assessment with any warnings
4. Commands to run and rollback the migration

## Important Rules

- NEVER generate a migration without a corresponding DOWN/rollback.
- NEVER use `DROP COLUMN` or `DROP TABLE` without explicitly warning the user about data loss.
- NEVER use `CREATE INDEX` without `CONCURRENTLY` on PostgreSQL (unless inside a transaction in a CREATE TABLE).
- ALWAYS wrap raw SQL migrations in a transaction (`BEGIN; ... COMMIT;`) unless using `CONCURRENTLY`.
- ALWAYS check for existing rows before adding NOT NULL constraints.
- If the project has a lock on migration ordering (sequential numbers), check the latest migration number before generating.
