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
    data.city ? `Location: ${String(data.city)}, ${String(data.state)}, ${String(data.country)}` : null,
    `Followers: ${data.follower_count} | Following: ${data.friend_count}`,
    shoes.length > 0
      ? "Shoes: " + shoes.map((s) => `${s.name} (${formatDistance(s.distance)})`).join(", ")
      : null,
    bikes.length > 0
      ? "Bikes: " + bikes.map((b) => `${b.name} (${formatDistance(b.distance)})`).join(", ")
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

function formatActivitySummary(a: Record<string, unknown>): Array<string | null> {
  return [
    String(a.name),
    `Type: ${String(a.type)} | ${formatDate(a.start_date_local as string)}`,
    a.description ? `Description: ${String(a.description)}` : null,
    "",
    `Distance: ${formatDistance(a.distance as number)}`,
    `Duration: ${formatDuration(a.moving_time as number)} (elapsed: ${formatDuration(a.elapsed_time as number)})`,
    `Pace: ${formatPace(a.average_speed as number)}`,
    `Elevation: +${Math.round(a.total_elevation_gain as number)}m`,
    a.average_heartrate ? `Heart rate: ${Math.round(a.average_heartrate as number)} avg / ${String(a.max_heartrate)} max bpm` : null,
    a.average_cadence ? `Cadence: ${Math.round(a.average_cadence as number)} spm` : null,
    a.calories ? `Calories: ${String(a.calories)}` : null,
    a.suffer_score ? `Suffer score: ${String(a.suffer_score)}` : null,
    a.device_name ? `Device: ${String(a.device_name)}` : null,
    a.gear ? `Gear: ${String((a.gear as Record<string, unknown>).name)}` : null,
    "",
    `Kudos: ${String(a.kudos_count)} | Comments: ${String(a.comment_count)} | PRs: ${String(a.pr_count)}`,
  ];
}

function formatBestEfforts(efforts: Array<Record<string, unknown>> | undefined): string[] {
  if (!efforts || efforts.length === 0) return [];
  const lines = ["", "Best efforts:"];
  for (const e of efforts) {
    const rank = e.pr_rank ? ` (PR #${String(e.pr_rank)})` : "";
    lines.push(`  ${String(e.name)}: ${formatDuration(e.moving_time as number)}${rank}`);
  }
  return lines;
}

function formatSplits(splits: Array<Record<string, number>> | undefined): string[] {
  if (!splits || splits.length <= 1) return [];
  const lines = ["", "Splits (per km):"];
  for (const s of splits) {
    lines.push(`  km ${s.split}: ${formatPace(s.average_speed)} | ${Math.round(s.elevation_difference)}m elev`);
  }
  return lines;
}

export async function getActivity(id: number): Promise<string> {
  const a = await stravaGet(`/activities/${id}`) as Record<string, unknown>;

  const lines = [
    ...formatActivitySummary(a),
    ...formatBestEfforts(a.best_efforts as Array<Record<string, unknown>> | undefined),
    ...formatSplits(a.splits_metric as Array<Record<string, number>> | undefined),
  ];

  return lines.filter(Boolean).join("\n");
}

export async function getActivityStreams(
  id: number,
  types: string[] = ["heartrate", "velocity_smooth", "cadence", "altitude"],
): Promise<string> {
  const keys = types.join(",");
  const data = await stravaGet(`/activities/${id}/streams`, {
    keys,
    key_type: "time",
  }) as Array<{ type: string; data: number[] }>;

  if (!data || data.length === 0) return "No stream data available for this activity.";

  const timeStream = data.find((s) => s.type === "time");
  const streams = data.filter((s) => s.type !== "time");

  if (streams.length === 0) return "No matching streams found.";

  // Downsample large datasets to ~100 points
  const sampleSize = streams[0].data.length;
  const step = sampleSize > 100 ? Math.floor(sampleSize / 100) : 1;

  const lines = [`Stream data (${sampleSize} points, showing every ${step}${step > 1 ? "th" : ""}):`];

  // Header
  const headers = ["time_s", ...streams.map((s) => formatStreamName(s.type))];
  lines.push(headers.join("\t"));

  // Rows
  for (let i = 0; i < sampleSize; i += step) {
    const time = timeStream ? String(timeStream.data[i]) : String(i);
    const values = streams.map((s) => formatStreamValue(s.type, s.data[i]));
    lines.push([time, ...values].join("\t"));
  }

  return lines.join("\n");
}

function formatStreamName(type: string): string {
  switch (type) {
    case "heartrate": return "hr_bpm";
    case "velocity_smooth": return "pace_/km";
    case "cadence": return "cadence_spm";
    case "altitude": return "altitude_m";
    default: return type;
  }
}

function formatStreamValue(type: string, value: number): string {
  if (value === null || value === undefined) return "N/A";
  switch (type) {
    case "velocity_smooth": return formatPace(value).replace(" /km", "");
    case "altitude": return String(Math.round(value));
    case "heartrate":
    case "cadence": return String(Math.round(value));
    default: return String(value);
  }
}

export async function getPersonalRecords(): Promise<string> {
  // Fetch recent activities in batches to find best efforts
  const allEfforts: Map<string, { time: number; date: string; activityName: string; activityId: number }> = new Map();

  for (let page = 1; page <= 5; page++) {
    const activities = await stravaGet("/athlete/activities", {
      page: String(page),
      per_page: "50",
    }) as Array<Record<string, unknown>>;

    if (activities.length === 0) break;

    for (const activity of activities) {
      if (activity.type !== "Run") continue;

      const detail = await stravaGet(`/activities/${String(activity.id)}`) as Record<string, unknown>;
      const efforts = detail.best_efforts as Array<Record<string, unknown>> | undefined;
      if (!efforts) continue;

      for (const effort of efforts) {
        if (effort.pr_rank !== 1) continue;
        const name = String(effort.name);
        const time = effort.moving_time as number;
        const existing = allEfforts.get(name);

        if (!existing || time < existing.time) {
          allEfforts.set(name, {
            time,
            date: formatDate(effort.start_date_local as string),
            activityName: String(activity.name),
            activityId: activity.id as number,
          });
        }
      }
    }
  }

  if (allEfforts.size === 0) return "No personal records found.";

  // Sort by distance (approximate from name)
  const distanceOrder = [
    "400m", "1/2 mile", "1K", "1 mile", "2 mile",
    "5K", "10K", "15K", "10 mile", "20K",
    "Half-Marathon", "30K", "Marathon", "50K",
  ];

  const sorted = [...allEfforts.entries()].sort((a, b) => {
    const ia = distanceOrder.indexOf(a[0]);
    const ib = distanceOrder.indexOf(b[0]);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  const lines = ["Personal Records:"];
  for (const [name, pr] of sorted) {
    lines.push(`  ${name}: ${formatDuration(pr.time)} (${pr.date}, "${pr.activityName}", ID: ${pr.activityId})`);
  }

  return lines.join("\n");
}

export async function getStarredSegments(): Promise<string> {
  const segments = await stravaGet("/segments/starred") as Array<Record<string, unknown>>;

  if (!segments || segments.length === 0) return "No starred segments found.";

  const lines = ["Starred segments:"];

  for (const seg of segments) {
    const segLines = [
      `${String(seg.name)}`,
      `  Distance: ${formatDistance(seg.distance as number)}`,
      `  Avg grade: ${String(seg.average_grade)}%`,
      `  Elevation: +${Math.round(seg.total_elevation_gain as number)}m`,
      `  Type: ${String(seg.activity_type)}`,
      `  City: ${String(seg.city)}, ${String(seg.state)}`,
      `  ID: ${String(seg.id)}`,
    ];

    // Fetch personal effort if available
    const efforts = await stravaGet(`/segment_efforts`, {
      segment_id: String(seg.id),
      per_page: "1",
    }) as Array<Record<string, unknown>>;

    if (efforts && efforts.length > 0) {
      const best = efforts[0];
      segLines.push(`  Your best: ${formatDuration(best.moving_time as number)} (${formatDate(best.start_date_local as string)})`);
    }

    lines.push(segLines.join("\n"));
  }

  return lines.join("\n\n");
}
