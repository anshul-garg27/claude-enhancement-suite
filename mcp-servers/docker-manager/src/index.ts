#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import Docker from "dockerode";

const docker = new Docker();

const server = new McpServer({
  name: "docker-manager",
  version: "1.0.0",
  description: "Read-only Docker container inspection and monitoring",
});

// List running containers
server.tool(
  "docker_ps",
  "List running containers with status, ports, and resource info",
  {
    all: z.boolean().optional().describe("Include stopped containers (default: false)"),
  },
  async ({ all }) => {
    const containers = await docker.listContainers({ all: all ?? false });
    const result = containers.map((c) => ({
      id: c.Id.slice(0, 12),
      name: c.Names[0]?.replace(/^\//, ""),
      image: c.Image,
      status: c.Status,
      state: c.State,
      ports: c.Ports.map(
        (p) =>
          `${p.PublicPort || ""}${p.PublicPort ? "->" : ""}${p.PrivatePort}/${p.Type}`
      ).join(", "),
      created: new Date(c.Created * 1000).toISOString(),
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Get container logs
server.tool(
  "docker_logs",
  "Get container logs (last N lines, with optional grep filter)",
  {
    container: z.string().describe("Container name or ID"),
    tail: z.number().optional().describe("Number of lines from end (default: 100)"),
    filter: z.string().optional().describe("Grep filter pattern"),
    since: z.string().optional().describe("Show logs since timestamp (e.g., '2024-01-01', '1h', '30m')"),
  },
  async ({ container, tail, filter, since }) => {
    const containerObj = docker.getContainer(container);
    const opts: Docker.ContainerLogsOptions = {
      stdout: true,
      stderr: true,
      tail: tail ?? 100,
      timestamps: true,
    };
    if (since) opts.since = since;

    const logs = await containerObj.logs(opts);
    let logText = logs.toString("utf-8");

    // Strip Docker stream headers (8-byte prefix per line)
    logText = logText
      .split("\n")
      .map((line) => (line.length > 8 ? line.slice(8) : line))
      .join("\n");

    if (filter) {
      const regex = new RegExp(filter, "gi");
      logText = logText
        .split("\n")
        .filter((line) => regex.test(line))
        .join("\n");
    }

    return {
      content: [{ type: "text", text: logText || "(no matching logs)" }],
    };
  }
);

// List images
server.tool(
  "docker_images",
  "List Docker images with sizes and tags",
  {
    filter: z.string().optional().describe("Filter by image name pattern"),
  },
  async ({ filter }) => {
    const images = await docker.listImages();
    let result = images.map((img) => ({
      id: img.Id.split(":")[1]?.slice(0, 12),
      tags: img.RepoTags || ["<none>"],
      size: `${(img.Size / 1024 / 1024).toFixed(1)} MB`,
      created: new Date(img.Created * 1000).toISOString(),
    }));

    if (filter) {
      const regex = new RegExp(filter, "i");
      result = result.filter((img) =>
        img.tags.some((tag) => regex.test(tag))
      );
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Inspect container
server.tool(
  "docker_inspect",
  "Inspect a container's full configuration",
  {
    container: z.string().describe("Container name or ID"),
  },
  async ({ container }) => {
    const containerObj = docker.getContainer(container);
    const info = await containerObj.inspect();
    const summary = {
      id: info.Id.slice(0, 12),
      name: info.Name.replace(/^\//, ""),
      image: info.Config.Image,
      command: info.Config.Cmd?.join(" "),
      entrypoint: info.Config.Entrypoint?.join(" "),
      env: info.Config.Env?.filter((e) => {
        const SECRET_PATTERNS = /SECRET|PASSWORD|KEY=|TOKEN|AUTH|CREDENTIAL|PRIVATE|ACCESS_KEY|SIGNING|ENCRYPTION|BEARER|DATABASE_URL|MONGODB_URL|REDIS_URL|DSN|CONNECTION_STRING/i;
        return !SECRET_PATTERNS.test(e.split('=')[0]);
      }),
      ports: info.NetworkSettings.Ports,
      mounts: info.Mounts?.map((m) => ({
        source: m.Source,
        destination: m.Destination,
        mode: m.Mode,
        rw: m.RW,
      })),
      network: Object.keys(info.NetworkSettings.Networks || {}),
      restartPolicy: info.HostConfig.RestartPolicy,
      state: {
        status: info.State.Status,
        running: info.State.Running,
        startedAt: info.State.StartedAt,
        exitCode: info.State.ExitCode,
      },
    };
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
    };
  }
);

// Container stats
server.tool(
  "docker_stats",
  "Get real-time resource usage for running containers",
  {
    container: z
      .string()
      .optional()
      .describe("Specific container name/ID, or omit for all running"),
  },
  async ({ container }) => {
    if (container) {
      const c = docker.getContainer(container);
      const stats = await c.stats({ stream: false });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatStats(container, stats), null, 2),
          },
        ],
      };
    }

    const containers = await docker.listContainers();
    const allStats = await Promise.all(
      containers.map(async (c) => {
        const container = docker.getContainer(c.Id);
        const stats = await container.stats({ stream: false });
        return formatStats(c.Names[0]?.replace(/^\//, "") || c.Id.slice(0, 12), stats);
      })
    );

    return {
      content: [{ type: "text", text: JSON.stringify(allStats, null, 2) }],
    };
  }
);

function formatStats(name: string, stats: any) {
  const cpuDelta =
    stats.cpu_stats.cpu_usage.total_usage -
    stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta =
    stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const cpuPercent =
    systemDelta > 0
      ? ((cpuDelta / systemDelta) * (stats.cpu_stats.online_cpus || 1) * 100).toFixed(2)
      : "0.00";

  const memUsage = stats.memory_stats.usage || 0;
  const memLimit = stats.memory_stats.limit || 1;

  return {
    name,
    cpu: `${cpuPercent}%`,
    memory: `${(memUsage / 1024 / 1024).toFixed(1)} MB / ${(memLimit / 1024 / 1024 / 1024).toFixed(1)} GB`,
    memoryPercent: `${((memUsage / memLimit) * 100).toFixed(1)}%`,
    networkRx: formatBytes(
      Object.values(stats.networks || {}).reduce(
        (sum: number, n: any) => sum + (n.rx_bytes || 0),
        0
      )
    ),
    networkTx: formatBytes(
      Object.values(stats.networks || {}).reduce(
        (sum: number, n: any) => sum + (n.tx_bytes || 0),
        0
      )
    ),
    pids: stats.pids_stats?.current || 0,
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

// List networks
server.tool(
  "docker_networks",
  "List Docker networks and connected containers",
  {},
  async () => {
    const networks = await docker.listNetworks();
    const result = await Promise.all(
      networks.map(async (n) => {
        const network = docker.getNetwork(n.Id);
        const info = await network.inspect();
        return {
          name: n.Name,
          driver: n.Driver,
          scope: n.Scope,
          containers: Object.values(info.Containers || {}).map((c: any) => ({
            name: c.Name,
            ipv4: c.IPv4Address,
          })),
        };
      })
    );
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// List volumes
server.tool(
  "docker_volumes",
  "List Docker volumes with usage info",
  {},
  async () => {
    const { Volumes } = await docker.listVolumes();
    const result = (Volumes || []).map((v) => ({
      name: v.Name,
      driver: v.Driver,
      mountpoint: v.Mountpoint,
      scope: v.Scope,
      labels: v.Labels,
      createdAt: v.CreatedAt,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Docker Manager MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
