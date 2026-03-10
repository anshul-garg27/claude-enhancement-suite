#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import simpleGit from "simple-git";
import { glob } from "glob";
import { readFile, stat } from "fs/promises";
import { resolve, extname, relative } from "path";
import { execSync } from "child_process";

const server = new McpServer({
  name: "project-health",
  version: "1.0.0",
  description: "Code health metrics - git activity, complexity, dependencies, dead code",
});

function getCwd(): string {
  return process.env.PROJECT_DIR || process.cwd();
}

// Git activity metrics
server.tool(
  "git_activity",
  "Commits per day/week, active contributors, hotspot files (most changed)",
  {
    days: z.number().optional().describe("Look back N days (default: 30)"),
  },
  async ({ days }) => {
    const git = simpleGit(getCwd());
    const since = new Date();
    since.setDate(since.getDate() - (days ?? 30));
    const sinceStr = since.toISOString().split("T")[0];

    const log = await git.log({ "--since": sinceStr, "--stat": true });

    // Commits per day
    const commitsByDay: Record<string, number> = {};
    const authors: Record<string, number> = {};
    const fileChanges: Record<string, number> = {};

    for (const commit of log.all) {
      const day = commit.date.split("T")[0] || commit.date.split(" ")[0];
      commitsByDay[day] = (commitsByDay[day] || 0) + 1;
      authors[commit.author_name] = (authors[commit.author_name] || 0) + 1;

      if (commit.diff?.files) {
        for (const file of commit.diff.files) {
          fileChanges[file.file] = (fileChanges[file.file] || 0) + 1;
        }
      }
    }

    const hotspots = Object.entries(fileChanges)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([file, count]) => ({ file, changes: count }));

    const topAuthors = Object.entries(authors)
      .sort(([, a], [, b]) => b - a)
      .map(([name, commits]) => ({ name, commits }));

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          period: `Last ${days ?? 30} days`,
          totalCommits: log.total,
          commitsPerDay: commitsByDay,
          contributors: topAuthors,
          hotspotFiles: hotspots,
        }, null, 2),
      }],
    };
  }
);

// Git blame summary
server.tool(
  "git_blame_summary",
  "Who owns what percentage of a file or directory",
  {
    path: z.string().describe("File or directory path relative to project root"),
  },
  async ({ path: targetPath }) => {
    const cwd = getCwd();
    const fullPath = resolve(cwd, targetPath);
    const fileStat = await stat(fullPath).catch(() => null);

    let files: string[];
    if (fileStat?.isDirectory()) {
      files = await glob("**/*.{ts,tsx,js,jsx,py,go,java,rs}", {
        cwd: fullPath,
        absolute: true,
        ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**", "**/vendor/**"],
      });
    } else {
      files = [fullPath];
    }

    const ownership: Record<string, number> = {};
    let totalLines = 0;

    for (const file of files.slice(0, 50)) {
      try {
        const blame = execSync(
          `git blame --line-porcelain "${file}" 2>/dev/null | grep "^author " | sort | uniq -c | sort -rn`,
          { cwd, encoding: "utf-8", timeout: 10000 }
        );
        for (const line of blame.trim().split("\n")) {
          const match = line.trim().match(/^(\d+)\s+author\s+(.+)$/);
          if (match) {
            const count = parseInt(match[1]);
            const author = match[2];
            ownership[author] = (ownership[author] || 0) + count;
            totalLines += count;
          }
        }
      } catch {
        // Skip files that fail blame
      }
    }

    const result = Object.entries(ownership)
      .sort(([, a], [, b]) => b - a)
      .map(([author, lines]) => ({
        author,
        lines,
        percentage: `${((lines / totalLines) * 100).toFixed(1)}%`,
      }));

    return {
      content: [{
        type: "text",
        text: JSON.stringify({ path: targetPath, totalLines, ownership: result }, null, 2),
      }],
    };
  }
);

// Recent changes
server.tool(
  "git_recent_changes",
  "Files changed in last N days with change frequency",
  {
    days: z.number().optional().describe("Look back N days (default: 7)"),
  },
  async ({ days }) => {
    const git = simpleGit(getCwd());
    const since = new Date();
    since.setDate(since.getDate() - (days ?? 7));

    const log = await git.log({ "--since": since.toISOString(), "--stat": true });
    const fileChanges: Record<string, { count: number; lastChanged: string; authors: Set<string> }> = {};

    for (const commit of log.all) {
      if (commit.diff?.files) {
        for (const file of commit.diff.files) {
          if (!fileChanges[file.file]) {
            fileChanges[file.file] = { count: 0, lastChanged: commit.date, authors: new Set() };
          }
          fileChanges[file.file].count++;
          fileChanges[file.file].authors.add(commit.author_name);
        }
      }
    }

    const result = Object.entries(fileChanges)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 30)
      .map(([file, data]) => ({
        file,
        changeCount: data.count,
        lastChanged: data.lastChanged,
        authors: [...data.authors],
      }));

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Dependency audit
server.tool(
  "dependency_audit",
  "Check package.json/requirements.txt/go.mod for outdated and vulnerable deps",
  {},
  async () => {
    const cwd = getCwd();
    const results: Record<string, unknown> = {};

    // Node.js
    try {
      const pkgJson = JSON.parse(await readFile(resolve(cwd, "package.json"), "utf-8"));
      const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
      const depCount = Object.keys(deps).length;

      let outdated = "";
      try {
        outdated = execSync("npm outdated --json 2>/dev/null || true", {
          cwd,
          encoding: "utf-8",
          timeout: 30000,
        });
      } catch { /* ignore */ }

      let audit = "";
      try {
        audit = execSync("npm audit --json 2>/dev/null || true", {
          cwd,
          encoding: "utf-8",
          timeout: 30000,
        });
      } catch { /* ignore */ }

      results.nodejs = {
        totalDependencies: depCount,
        outdated: outdated ? JSON.parse(outdated) : {},
        vulnerabilities: audit ? JSON.parse(audit)?.metadata?.vulnerabilities : {},
      };
    } catch { /* no package.json */ }

    // Python
    try {
      await readFile(resolve(cwd, "requirements.txt"), "utf-8");
      let pipAudit = "";
      try {
        pipAudit = execSync("pip-audit --format json 2>/dev/null || true", {
          cwd,
          encoding: "utf-8",
          timeout: 30000,
        });
      } catch { /* ignore */ }
      results.python = { audit: pipAudit ? JSON.parse(pipAudit) : "pip-audit not installed" };
    } catch { /* no requirements.txt */ }

    // Go
    try {
      await readFile(resolve(cwd, "go.mod"), "utf-8");
      let goVuln = "";
      try {
        goVuln = execSync("govulncheck ./... 2>&1 || true", {
          cwd,
          encoding: "utf-8",
          timeout: 30000,
        });
      } catch { /* ignore */ }
      results.go = { vulnerabilities: goVuln || "govulncheck not installed" };
    } catch { /* no go.mod */ }

    if (Object.keys(results).length === 0) {
      return {
        content: [{ type: "text", text: "No dependency files found (package.json, requirements.txt, go.mod)" }],
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
    };
  }
);

// Code complexity metrics
server.tool(
  "code_complexity",
  "Count files, lines, functions per file, identify large files",
  {
    path: z.string().optional().describe("Directory to analyze (default: project root)"),
  },
  async ({ path: targetPath }) => {
    const cwd = resolve(getCwd(), targetPath || ".");
    const extensions = ["ts", "tsx", "js", "jsx", "py", "go", "java", "rs"];
    const pattern = `**/*.{${extensions.join(",")}}`;

    const files = await glob(pattern, {
      cwd,
      ignore: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.git/**", "**/vendor/**", "**/__pycache__/**"],
    });

    const fileMetrics = await Promise.all(
      files.map(async (file) => {
        const fullPath = resolve(cwd, file);
        const content = await readFile(fullPath, "utf-8");
        const lines = content.split("\n").length;
        const ext = extname(file);

        // Count functions/methods (rough heuristic)
        let functionCount = 0;
        if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
          functionCount = (content.match(/(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\(|(?:async\s+)?[\w]+\s*\([^)]*\)\s*\{|=>\s*\{)/g) || []).length;
        } else if (ext === ".py") {
          functionCount = (content.match(/^\s*(?:def|async def)\s+\w+/gm) || []).length;
        } else if (ext === ".go") {
          functionCount = (content.match(/^func\s+/gm) || []).length;
        } else if (ext === ".java") {
          functionCount = (content.match(/(?:public|private|protected|static)\s+\w+\s+\w+\s*\(/g) || []).length;
        }

        return { file: relative(getCwd(), fullPath), lines, functions: functionCount, ext };
      })
    );

    // Aggregate by extension
    const byExtension: Record<string, { files: number; lines: number }> = {};
    for (const m of fileMetrics) {
      if (!byExtension[m.ext]) byExtension[m.ext] = { files: 0, lines: 0 };
      byExtension[m.ext].files++;
      byExtension[m.ext].lines += m.lines;
    }

    const largeFiles = fileMetrics
      .filter((f) => f.lines > 300)
      .sort((a, b) => b.lines - a.lines)
      .slice(0, 20);

    const complexFiles = fileMetrics
      .filter((f) => f.functions > 15)
      .sort((a, b) => b.functions - a.functions)
      .slice(0, 20);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          summary: {
            totalFiles: fileMetrics.length,
            totalLines: fileMetrics.reduce((s, f) => s + f.lines, 0),
            byExtension,
          },
          largeFiles: largeFiles.map((f) => ({ file: f.file, lines: f.lines })),
          complexFiles: complexFiles.map((f) => ({ file: f.file, functions: f.functions, lines: f.lines })),
        }, null, 2),
      }],
    };
  }
);

// TODO scan
server.tool(
  "todo_scan",
  "Find all TODO/FIXME/HACK/XXX comments across codebase",
  {
    pattern: z.string().optional().describe("Additional pattern to search (default: TODO|FIXME|HACK|XXX)"),
  },
  async ({ pattern }) => {
    const cwd = getCwd();
    const searchPattern = pattern || "TODO|FIXME|HACK|XXX|WORKAROUND";

    try {
      const result = execSync(
        `grep -rn --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.py" --include="*.go" --include="*.java" -E "(${searchPattern})" . --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git --exclude-dir=vendor 2>/dev/null | head -100`,
        { cwd, encoding: "utf-8", timeout: 15000 }
      );

      const todos = result
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const match = line.match(/^\.\/(.+?):(\d+):(.+)$/);
          if (!match) return null;
          const tag = match[3].match(/(TODO|FIXME|HACK|XXX|WORKAROUND)/i)?.[1] || "OTHER";
          return { file: match[1], line: parseInt(match[2]), tag, text: match[3].trim() };
        })
        .filter(Boolean);

      // Group by tag
      const byTag: Record<string, number> = {};
      for (const todo of todos) {
        if (todo) {
          byTag[todo.tag] = (byTag[todo.tag] || 0) + 1;
        }
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ summary: byTag, total: todos.length, items: todos }, null, 2),
        }],
      };
    } catch {
      return { content: [{ type: "text", text: "No TODOs found or grep not available" }] };
    }
  }
);

// Dead code detection
server.tool(
  "dead_code_detect",
  "Find exported functions/types that are never imported elsewhere",
  {
    path: z.string().optional().describe("Directory to scan (default: src/)"),
  },
  async ({ path: targetPath }) => {
    const cwd = getCwd();
    const scanDir = resolve(cwd, targetPath || "src");

    const files = await glob("**/*.{ts,tsx,js,jsx}", {
      cwd: scanDir,
      ignore: ["**/*.test.*", "**/*.spec.*", "**/__tests__/**", "**/node_modules/**"],
    });

    const exports: { name: string; file: string; line: number }[] = [];
    const imports = new Set<string>();

    for (const file of files) {
      const content = await readFile(resolve(scanDir, file), "utf-8");
      const lines = content.split("\n");

      // Find exports
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const exportMatch = line.match(/export\s+(?:(?:async\s+)?function|const|let|var|class|interface|type|enum)\s+(\w+)/);
        if (exportMatch) {
          exports.push({ name: exportMatch[1], file, line: i + 1 });
        }
      }

      // Find imports
      const importMatches = content.matchAll(/import\s+(?:type\s+)?{([^}]+)}/g);
      for (const match of importMatches) {
        const names = match[1].split(",").map((n) => n.trim().split(/\s+as\s+/)[0].trim());
        names.forEach((n) => imports.add(n));
      }

      // Default imports
      const defaultMatches = content.matchAll(/import\s+(\w+)\s+from/g);
      for (const match of defaultMatches) {
        imports.add(match[1]);
      }
    }

    const unused = exports.filter((e) => !imports.has(e.name));

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          totalExports: exports.length,
          potentiallyUnused: unused.length,
          unused: unused.slice(0, 50),
          note: "These exports have no corresponding imports in the scanned directory. They may be used externally or dynamically.",
        }, null, 2),
      }],
    };
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Project Health MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
