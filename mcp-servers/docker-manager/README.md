# Docker Manager MCP Server

Read-only Docker container inspection and monitoring for Claude Code.

## Tools

| Tool | Description |
|------|-------------|
| `docker_ps` | List running containers with status and ports |
| `docker_logs` | Get container logs (tail N lines, grep filter) |
| `docker_images` | List images with sizes and tags |
| `docker_inspect` | Inspect container configuration (secrets filtered out) |
| `docker_stats` | Real-time CPU, memory, network usage |
| `docker_networks` | List networks and connected containers |
| `docker_volumes` | List volumes with usage info |

## Security

All operations are **READ-ONLY**. No start/stop/remove/exec commands. Environment variables containing SECRET, PASSWORD, or KEY are filtered from inspect output.

## Setup

```bash
cd mcp-servers/docker-manager
npm install
```

## Claude Code Configuration

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "docker-manager": {
      "command": "npx",
      "args": ["tsx", "/path/to/mcp-servers/docker-manager/src/index.ts"]
    }
  }
}
```

## Requirements

- Docker must be running and accessible via the Docker socket
- Node.js 18+
