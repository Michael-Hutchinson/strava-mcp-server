# strava-mcp-server

[![npm version](https://img.shields.io/npm/v/%40michaelhutchinson%2Fstrava-mcp-server)](https://www.npmjs.com/package/@michaelhutchinson/strava-mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/%40michaelhutchinson%2Fstrava-mcp-server)](https://www.npmjs.com/package/@michaelhutchinson/strava-mcp-server)
[![license](https://img.shields.io/npm/l/%40michaelhutchinson%2Fstrava-mcp-server)](./LICENSE)

An MCP server that connects Claude to your Strava data. Query your activities, stats, and athlete profile directly from Claude Code.

## Tools

| Tool                     | Description                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| `get_athlete`            | Athlete profile, gear (shoes/bikes), follower counts                                             |
| `get_stats`              | Running totals: all-time, year-to-date, last 4 weeks                                             |
| `get_activities`         | List recent activities with pace, distance, HR, elevation. Supports pagination and date filtering |
| `get_activity`           | Full activity detail by ID: splits, best efforts, heart rate, gear                               |
| `get_activity_streams`   | Time-series data: heart rate, pace, cadence, altitude over the course of an activity              |
| `get_personal_records`   | Personal best times across standard distances (5K, 10K, half marathon, marathon, etc.)            |
| `get_starred_segments`   | Your favourite Strava segments with your personal best effort on each                             |

## Quick start

### 1. Create a Strava API app

Go to [strava.com/settings/api](https://www.strava.com/settings/api) and create an app.

Set the **Authorization Callback Domain** to `localhost`.

Note your **Client ID** and **Client Secret**.

### 2. Run the setup

```bash
npx @michaelhutchinson/strava-mcp-server setup
```

This opens your browser, authorizes with Strava, and gives you the exact command to add the server to Claude Code.

### 3. Restart Claude Code

Close and reopen Claude Code. You're ready to go.

### Claude Desktop

Also works with Claude Desktop. Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "strava": {
      "command": "npx",
      "args": ["-y", "@michaelhutchinson/strava-mcp-server"],
      "env": {
        "STRAVA_CLIENT_ID": "your_client_id",
        "STRAVA_CLIENT_SECRET": "your_client_secret",
        "STRAVA_REFRESH_TOKEN": "your_refresh_token"
      }
    }
  }
}
```

Claude Desktop can render charts and graphs from your running data.

## Example questions

Once set up, you can ask Claude things like:

**Stats and records**
- "What are my running stats this year?"
- "What's my 5K personal best?"
- "How does my mileage this month compare to last month?"

**Activities**
- "Show my last 5 runs"
- "What did I run last weekend?"
- "Get the details for my most recent activity"
- "Show my runs from January"

**Analysis**
- "How was my heart rate during my last long run?"
- "Show my pace splits for activity 12345678"
- "Am I running faster this year compared to last year?"

**Segments**
- "Show my starred segments"
- "What's my best time on my favourite segment?"

Claude picks the right tools automatically based on your question.

## Manual setup

If you prefer to configure manually:

```bash
claude mcp add strava \
  -e STRAVA_CLIENT_ID=your_client_id \
  -e STRAVA_CLIENT_SECRET=your_client_secret \
  -e STRAVA_REFRESH_TOKEN=your_refresh_token \
  -- npx -y @michaelhutchinson/strava-mcp-server
```

See [Strava's OAuth guide](https://developers.strava.com/docs/getting-started/#oauth) for how to obtain a refresh token manually.

## License

MIT — covers the code in this repository only.

This is an unofficial, community-built tool. It is not affiliated with, endorsed by, or sponsored by Strava. Strava and the Strava logo are trademarks of Strava, Inc. Your use of the Strava API through this tool is subject to the [Strava API Agreement](https://www.strava.com/legal/api).
