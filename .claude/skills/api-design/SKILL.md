---
name: api-design
description: Design REST/GraphQL APIs with OpenAPI spec generation, endpoint design, and schema validation
user-invocable: true
argument-hint: "API description, e.g. 'user management CRUD API' or 'e-commerce checkout flow'"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
---

# API Design Skill

You are an expert API architect. When the user describes an API they need, guide them through a structured design process and generate production-ready code.

## Input

The user provides a description of the API they need. Examples:
- "user management CRUD API"
- "e-commerce checkout flow"
- "file upload service with presigned URLs"
- "real-time notifications API with WebSocket"

## Process

### Step 1: Discover the Project Context

Before designing anything, understand the existing codebase:

1. Check for existing API patterns:
   - Search for route/handler files to identify the framework (Express, Fastify, Next.js, Gin, Echo, FastAPI, Spring Boot)
   - Search for existing middleware, auth patterns, and error handling
   - Look for existing OpenAPI/Swagger specs
   - Identify the validation library in use (Zod, Joi, Pydantic, Go validator)

2. Check for existing database schema:
   - Look for Prisma schema, Drizzle config, SQLAlchemy models, GORM models
   - Identify existing tables/models related to the new API

3. Check for existing conventions:
   - Response envelope format (e.g., `{ data, error, meta }`)
   - Authentication mechanism (JWT, session, API key)
   - Existing error codes and formats

### Step 2: Resource Identification and Naming

Based on the user's description, identify:

1. **Primary resources** (nouns, not verbs):
   - Use plural nouns: `/users`, `/orders`, `/products`
   - Use kebab-case for multi-word: `/order-items`, `/user-profiles`
   - Nest related resources: `/users/{userId}/orders`

2. **Resource relationships**:
   - One-to-many: nest or use query params
   - Many-to-many: use a junction resource or query params
   - Keep nesting to max 2 levels deep

3. **Present the resource map to the user** before proceeding.

### Step 3: Endpoint Design

For each resource, define endpoints following REST conventions:

| Operation | Method | Path | Status |
|-----------|--------|------|--------|
| List | GET | /resources | 200 |
| Get one | GET | /resources/{id} | 200 |
| Create | POST | /resources | 201 |
| Full update | PUT | /resources/{id} | 200 |
| Partial update | PATCH | /resources/{id} | 200 |
| Delete | DELETE | /resources/{id} | 204 |
| Batch create | POST | /resources/batch | 201 |
| Search | POST | /resources/search | 200 |

For actions that don't fit CRUD, use:
- `POST /resources/{id}/actions/{action}` (e.g., `POST /orders/{id}/actions/cancel`)

### Step 4: Request/Response Schema Design

Design schemas using the project's validation library:

**TypeScript (Zod)**:
```typescript
export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  role: z.enum(["admin", "user", "viewer"]).default("user"),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
```

**Python (Pydantic)**:
```python
class CreateUserRequest(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=255)
    role: Literal["admin", "user", "viewer"] = "user"
```

**Go (structs)**:
```go
type CreateUserRequest struct {
    Email string `json:"email" validate:"required,email"`
    Name  string `json:"name" validate:"required,min=1,max=255"`
    Role  string `json:"role" validate:"oneof=admin user viewer"`
}
```

### Step 5: Error Response Standardization (RFC 7807)

All error responses MUST follow RFC 7807 Problem Details format:

```json
{
  "type": "https://api.example.com/errors/validation-failed",
  "title": "Validation Failed",
  "status": 422,
  "detail": "The request body contains invalid fields.",
  "instance": "/users",
  "errors": [
    {
      "field": "email",
      "message": "Must be a valid email address",
      "code": "invalid_format"
    }
  ]
}
```

Standard error types to implement:
- `400` - Bad Request (malformed JSON, missing required fields)
- `401` - Unauthorized (missing or invalid auth token)
- `403` - Forbidden (valid auth but insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `409` - Conflict (duplicate resource, optimistic locking failure)
- `422` - Unprocessable Entity (validation errors)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error (unexpected failures)

### Step 6: OpenAPI 3.1 Spec Generation

Generate a complete OpenAPI 3.1 specification that includes:

- Info section with title, description, version
- Server URLs for dev/staging/production
- Path definitions with all endpoints
- Request body schemas with examples
- Response schemas for success and error cases
- Security schemes (Bearer JWT, API Key, OAuth2)
- Tags for grouping endpoints
- Pagination parameters as reusable components

Write the spec to a file like `openapi.yaml` or `docs/api-spec.yaml`.

### Step 7: Authentication and Authorization Design

Based on the project's existing auth patterns:

1. **Authentication**: Identify which endpoints need auth
   - Public endpoints (login, register, health check)
   - Authenticated endpoints (most CRUD operations)
   - Admin-only endpoints (user management, system config)

2. **Authorization**: Define permission model
   - Role-based (RBAC): admin, editor, viewer
   - Resource-based: user can only access their own resources
   - Attribute-based (ABAC): complex policies

3. **Generate middleware/guards** for the project's framework.

### Step 8: Pagination, Filtering, and Sorting

Implement cursor-based pagination for all list endpoints:

```
GET /users?cursor=eyJpZCI6MTAwfQ&limit=20&sort=created_at:desc&filter[status]=active
```

Response envelope:
```json
{
  "data": [...],
  "pagination": {
    "cursor": "eyJpZCI6MTIwfQ",
    "hasMore": true,
    "totalCount": 1543
  }
}
```

- Default page size: 20, max: 100
- Support offset-based pagination as fallback if needed
- Filtering: use bracket notation `filter[field]=value`
- Sorting: `sort=field:asc,field2:desc`
- Include `totalCount` only when explicitly requested via `include=totalCount`

### Step 9: Rate Limiting

Define rate limits per endpoint category:

| Category | Limit | Window |
|----------|-------|--------|
| Public (unauthenticated) | 60 req | 1 min |
| Authenticated reads | 300 req | 1 min |
| Authenticated writes | 60 req | 1 min |
| Admin endpoints | 120 req | 1 min |
| File uploads | 10 req | 1 min |

Include rate limit headers in responses:
```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 297
X-RateLimit-Reset: 1640000000
```

### Step 10: Versioning Strategy

Use URL path versioning:
- `/api/v1/users` - current stable version
- `/api/v2/users` - next version (if breaking changes needed)

Rules:
- Additive changes (new fields, new endpoints) do NOT require a new version
- Breaking changes (removed fields, changed types, removed endpoints) require a new version
- Deprecation: add `Sunset` header with removal date, minimum 6 months notice

### Step 11: Generate Implementation Code

Generate the actual implementation files:

1. **Route/handler files** - endpoint definitions with middleware
2. **Service layer** - business logic separated from HTTP concerns
3. **Validation schemas** - input validation for all endpoints
4. **Types/interfaces** - shared type definitions
5. **Error handling** - centralized error handler middleware
6. **Tests** - at minimum, one happy-path and one error-path test per endpoint
7. **Database queries** - if the API requires new tables or queries

Follow the project's existing file organization. If no pattern exists, use:
```
src/
  api/
    v1/
      {resource}/
        {resource}.routes.ts
        {resource}.handlers.ts
        {resource}.service.ts
        {resource}.schemas.ts
        {resource}.test.ts
  middleware/
    auth.ts
    error-handler.ts
    rate-limit.ts
    validate.ts
  types/
    {resource}.ts
```

## Output

Deliver:
1. Resource map and endpoint list (confirmed with user)
2. OpenAPI 3.1 specification file
3. All implementation code files
4. Test files with happy-path and error-path coverage
5. Summary of what was created and next steps
