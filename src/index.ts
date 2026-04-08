#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getAthlete, getStats, getActivities, getActivity } from "./strava.js";

const server = new McpServer({
  name: "strava-mcp-server",
  version: "1.0.0",
});

server.tool(
  "get_athlete",
  "Get your Strava athlete profile including gear (shoes, bikes) and follower counts",
  {},
  async () => {
    const text = await getAthlete();
    return { content: [{ type: "text", text }] };
  }
);

server.tool(
  "get_stats",
  "Get running statistics: all-time totals, year-to-date, and last 4 weeks. Includes run count, distance, time, and elevation.",
  {},
  async () => {
    const text = await getStats();
    return { content: [{ type: "text", text }] };
  }
);

server.tool(
  "get_activities",
  "List recent Strava activities with distance, pace, duration, heart rate, and elevation. Supports pagination and date filtering.",
  {
    page: z.number().optional().default(1).describe("Page number (default 1)"),
    per_page: z.number().optional().default(10).describe("Activities per page, max 50 (default 10)"),
    after: z.string().optional().describe("Only activities after this date (ISO 8601, e.g. 2026-01-01)"),
    before: z.string().optional().describe("Only activities before this date (ISO 8601)"),
  },
  async ({ page, per_page, after, before }) => {
    const text = await getActivities(page, per_page, after, before);
    return { content: [{ type: "text", text }] };
  }
);

server.tool(
  "get_activity",
  "Get full details for a specific activity by ID. Includes splits, best efforts, heart rate, gear, and more.",
  {
    id: z.number().describe("Strava activity ID"),
  },
  async ({ id }) => {
    const text = await getActivity(id);
    return { content: [{ type: "text", text }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Server error:", err);
  process.exit(1);
});
