# strava-mcp-server

An MCP server that connects Claude to your Strava data. Query your activities, stats, and athlete profile directly from Claude Code.

## Tools

| Tool | Description |
|------|-------------|
| `get_athlete` | Athlete profile, gear (shoes/bikes), follower counts |
| `get_stats` | Running totals: all-time, year-to-date, last 4 weeks |
| `get_activities` | List recent activities with pace, distance, HR, elevation. Supports pagination and date filtering |
| `get_activity` | Full activity detail by ID: splits, best efforts, heart rate zones, gear |

## Setup

### 1. Create a Strava API application

Go to [strava.com/settings/api](https://www.strava.com/settings/api) and create an app. You'll need the Client ID and Client Secret.

### 2. Get a refresh token

Follow [Strava's OAuth guide](https://developers.strava.com/docs/getting-started/#oauth) to authorize your app and get a refresh token with `read,activity:read` scopes.

### 3. Configure Claude Code

Add to your `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "strava": {
      "command": "node",
      "args": ["/path/to/strava-mcp-server/dist/index.js"],
      "env": {
        "STRAVA_CLIENT_ID": "your_client_id",
        "STRAVA_CLIENT_SECRET": "your_client_secret",
        "STRAVA_REFRESH_TOKEN": "your_refresh_token"
      }
    }
  }
}
```

### 4. Build

```bash
npm install
npm run build
```

## Usage

Once configured, Claude Code can access your Strava data:

```
> get my running stats for this year
> show my last 5 activities
> get details for activity 12345678
> what's my total mileage this year?
```

## License

MIT
