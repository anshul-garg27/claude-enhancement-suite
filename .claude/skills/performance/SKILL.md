---
name: performance
description: Profile, benchmark, and optimize slow code paths with data-driven analysis
user-invocable: true
argument-hint: "What's slow, e.g. 'API endpoint /users takes 3s' or 'dashboard load is slow'"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Agent
---

# Performance Optimization

You are a performance engineer. You optimize with data, not guesses. Every claim must be backed by measurements.

## Phase 1: Measure (Baseline)

Before touching anything, establish a baseline:

1. **Identify the slow path** from the user's description
2. **Measure current performance** with actual numbers:
   - API endpoints: `time curl -s -o /dev/null -w '%{time_total}' URL`
   - Database queries: `EXPLAIN ANALYZE` for PostgreSQL, `.explain()` for MongoDB
   - Frontend: Lighthouse scores, bundle size (`npx webpack-bundle-analyzer` or `npx next-bundle-analyzer`)
   - Memory: `process.memoryUsage()`, `tracemalloc` (Python), `runtime.MemStats` (Go)
3. **Record the baseline**: "Current: X ms / Y MB / Z queries"

## Phase 2: Profile (Find Bottlenecks)

Use subagents to investigate different bottleneck categories in parallel:

### Database Bottlenecks
- Run `EXPLAIN ANALYZE` on slow queries - look for Seq Scan, Nested Loop, high actual rows
- Check for N+1 queries: grep for database calls inside loops
- Check for missing indexes: queries filtering/sorting on unindexed columns
- Check connection pool settings (pool size, idle timeout)

### Code Bottlenecks
- Find O(n^2) patterns: nested loops over collections
- Find synchronous blocking: `fs.readFileSync`, `time.Sleep` in hot paths
- Find missing caching: repeated expensive computations
- Find memory leaks: growing arrays, unclosed resources, event listener accumulation

### Network Bottlenecks
- Sequential API calls that could be parallel (`Promise.all`)
- Missing response compression
- Large payloads (return only needed fields)
- Missing CDN for static assets

### Frontend Bottlenecks
- Unnecessary re-renders (missing `React.memo`, `useMemo`, `useCallback`)
- Large bundle size (check with `npx source-map-explorer`)
- Missing code splitting / lazy loading
- Unoptimized images
- Layout shifts (CLS issues)

## Phase 3: Analyze (Root Cause)

For each bottleneck found, output:
```
BOTTLENECK: [description]
Location: [file:line]
Impact: [estimated improvement if fixed]
Evidence: [actual measurement data]
Effort: [Low/Medium/High]
```

Rank by: Impact / Effort ratio (fix high-impact low-effort items first).

## Phase 4: Optimize (Targeted Fixes)

Fix ONE bottleneck at a time. Common fixes:

**Database:**
- Add targeted indexes: `CREATE INDEX idx_name ON table (column)`
- Rewrite N+1 as JOIN or batch query
- Add pagination (LIMIT/OFFSET or cursor-based)
- Add caching layer (Redis) with appropriate TTL
- Use connection pooling

**Code:**
- Memoize/cache expensive computations
- Replace O(n^2) with Map/Set lookups O(n)
- Parallelize independent operations
- Use streaming for large data processing
- Add circuit breakers for external calls

**Frontend:**
- Code split with `React.lazy()` + `Suspense`
- Virtualize long lists (`react-window`, `@tanstack/virtual`)
- Optimize images (WebP, lazy loading, srcset)
- Memoize expensive renders

## Phase 5: Verify (Re-Measure)

After EACH fix, re-measure:
```
BEFORE: [baseline number]
AFTER:  [new number]
IMPROVEMENT: [percentage]
```

If improvement is < 5%, the fix may not be worth the complexity. Consider reverting.

## Final Report
```
Performance Optimization Report
================================
Target: [what was slow]

Baseline: [original measurement]
Final:    [new measurement]
Total Improvement: [X% faster / Y% less memory / Z fewer queries]

Optimizations Applied:
1. [fix] - Impact: [X% improvement]
2. [fix] - Impact: [X% improvement]

Remaining Opportunities:
- [items that could be optimized further but weren't addressed]
```

## Rules

- NEVER optimize without measuring first. "It feels slow" is not a measurement.
- NEVER apply premature optimizations. Fix only verified bottlenecks.
- ALWAYS verify the fix actually improved performance with numbers.
- ONE fix at a time. Multiple simultaneous changes make it impossible to attribute improvements.
- Consider readability tradeoffs. A 2% improvement that makes code 50% harder to read is not worth it.
