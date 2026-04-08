const STRAVA_BASE = "https://www.strava.com/api/v3";

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt * 1000 > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  const refreshToken = process.env.STRAVA_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing Strava credentials. Set STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, and STRAVA_REFRESH_TOKEN."
    );
  }

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    throw new Error(`Strava token refresh failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  cachedToken = { accessToken: data.access_token, expiresAt: data.expires_at };
  return data.access_token;
}

async function stravaGet(path: string, params?: Record<string, string>): Promise<unknown> {
  const token = await getAccessToken();
  const url = new URL(`${STRAVA_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Strava API ${path}: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

// --- Formatting helpers ---

function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(2)} km`;
}

function formatPace(avgSpeed: number): string {
  if (!avgSpeed || avgSpeed === 0) return "N/A";
  const paceSeconds = 1000 / avgSpeed;
  const mins = Math.floor(paceSeconds / 60);
  const secs = Math.floor(paceSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")} /km`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// --- Public API ---

export async function getAthlete(): Promise<string> {
  const data = await stravaGet("/athlete") as Record<string, unknown>;
  const shoes = (data.shoes as Array<{ name: string; distance: number }>) || [];
  const bikes = (data.bikes as Array<{ name: string; distance: number }>) || [];

  const lines = [
    `${data.firstname} ${data.lastname}`,
    data.city ? `Location: ${data.city}, ${data.state}, ${data.country}` : null,
    `Followers: ${data.follower_count} | Following: ${data.friend_count}`,
    shoes.length > 0
      ? `Shoes: ${shoes.map((s) => `${s.name} (${formatDistance(s.distance)})`).join(", ")}`
      : null,
    bikes.length > 0
      ? `Bikes: ${bikes.map((b) => `${b.name} (${formatDistance(b.distance)})`).join(", ")}`
      : null,
  ];

  return lines.filter(Boolean).join("\n");
}

export async function getStats(): Promise<string> {
  const athleteId = process.env.STRAVA_ATHLETE_ID;
  if (!athleteId) {
    // Fall back to fetching athlete first
    const athlete = await stravaGet("/athlete") as Record<string, unknown>;
    process.env.STRAVA_ATHLETE_ID = String(athlete.id);
  }

  const data = await stravaGet(`/athletes/${process.env.STRAVA_ATHLETE_ID}/stats`) as Record<string, unknown>;

  function formatTotals(label: string, totals: Record<string, number>): string {
    if (!totals || totals.count === 0) return `${label}: No activities`;
    return [
      `${label}:`,
      `  Runs: ${totals.count}`,
      `  Distance: ${formatDistance(totals.distance)}`,
      `  Time: ${formatDuration(totals.moving_time)}`,
      `  Elevation: ${Math.round(totals.elevation_gain)}m`,
    ].join("\n");
  }

  const sections = [
    formatTotals("All time", data.all_run_totals as Record<string, number>),
    formatTotals("This year", data.ytd_run_totals as Record<string, number>),
    formatTotals("Last 4 weeks", data.recent_run_totals as Record<string, number>),
  ];

  return sections.join("\n\n");
}

export async function getActivities(
  page: number = 1,
  perPage: number = 10,
  after?: string,
  before?: string,
): Promise<string> {
  const params: Record<string, string> = {
    page: String(page),
    per_page: String(Math.min(perPage, 50)),
  };

  if (after) params.after = String(Math.floor(new Date(after).getTime() / 1000));
  if (before) params.before = String(Math.floor(new Date(before).getTime() / 1000));

  const activities = await stravaGet("/athlete/activities", params) as Array<Record<string, unknown>>;

  if (activities.length === 0) return "No activities found.";

  return activities
    .map((a) => {
      const lines = [
        `${a.name} (${a.type})`,
        `  Date: ${formatDate(a.start_date_local as string)}`,
        `  Distance: ${formatDistance(a.distance as number)}`,
        `  Duration: ${formatDuration(a.moving_time as number)}`,
        `  Pace: ${formatPace(a.average_speed as number)}`,
        `  Elevation: ${Math.round(a.total_elevation_gain as number)}m`,
        a.average_heartrate ? `  Avg HR: ${Math.round(a.average_heartrate as number)} bpm` : null,
        `  ID: ${a.id}`,
      ];
      return lines.filter(Boolean).join("\n");
    })
    .join("\n\n");
}

export async function getActivity(id: number): Promise<string> {
  const a = await stravaGet(`/activities/${id}`) as Record<string, unknown>;

  const lines = [
    `${a.name}`,
    `Type: ${a.type} | ${formatDate(a.start_date_local as string)}`,
    a.description ? `Description: ${a.description}` : null,
    "",
    `Distance: ${formatDistance(a.distance as number)}`,
    `Duration: ${formatDuration(a.moving_time as number)} (elapsed: ${formatDuration(a.elapsed_time as number)})`,
    `Pace: ${formatPace(a.average_speed as number)}`,
    `Elevation: +${Math.round(a.total_elevation_gain as number)}m`,
    a.average_heartrate ? `Heart rate: ${Math.round(a.average_heartrate as number)} avg / ${a.max_heartrate} max bpm` : null,
    a.average_cadence ? `Cadence: ${Math.round(a.average_cadence as number)} spm` : null,
    a.calories ? `Calories: ${a.calories}` : null,
    a.suffer_score ? `Suffer score: ${a.suffer_score}` : null,
    a.device_name ? `Device: ${a.device_name}` : null,
    a.gear ? `Gear: ${(a.gear as Record<string, unknown>).name}` : null,
    "",
    `Kudos: ${a.kudos_count} | Comments: ${a.comment_count} | PRs: ${a.pr_count}`,
  ];

  // Best efforts
  const efforts = a.best_efforts as Array<Record<string, unknown>> | undefined;
  if (efforts && efforts.length > 0) {
    lines.push("", "Best efforts:");
    for (const e of efforts) {
      const rank = e.pr_rank ? ` (PR #${e.pr_rank})` : "";
      lines.push(`  ${e.name}: ${formatDuration(e.moving_time as number)}${rank}`);
    }
  }

  // Splits
  const splits = a.splits_metric as Array<Record<string, number>> | undefined;
  if (splits && splits.length > 1) {
    lines.push("", "Splits (per km):");
    for (const s of splits) {
      lines.push(`  km ${s.split}: ${formatPace(s.average_speed)} | ${Math.round(s.elevation_difference)}m elev`);
    }
  }

  return lines.filter(Boolean).join("\n");
}
