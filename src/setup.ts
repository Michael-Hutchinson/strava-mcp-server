import { createServer } from "node:http";
import { createInterface } from "node:readline";
import { exec } from "node:child_process";

const STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const PORT = 8420;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function openBrowser(url: string) {
  let cmd: string;
  if (process.platform === "darwin") {
    cmd = `open "${url}"`;
  } else if (process.platform === "win32") {
    cmd = `start "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }
  exec(cmd);
}

function waitForCallback(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url || "/", `http://localhost:${PORT}`);

      if (url.pathname === "/callback") {
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end("<h1>Authorization denied</h1><p>You can close this tab.</p>");
          server.close();
          reject(new Error(`Authorization denied: ${error}`));
          return;
        }

        if (code) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(
            "<h1>Authorized!</h1><p>You can close this tab and go back to your terminal.</p>"
          );
          server.close();
          resolve(code);
          return;
        }
      }

      res.writeHead(404);
      res.end();
    });

    server.listen(PORT, () => {});

    setTimeout(() => {
      server.close();
      reject(new Error("Timed out waiting for authorization (2 minutes)"));
    }, 120_000);
  });
}

async function exchangeCode(
  clientId: string,
  clientSecret: string,
  code: string
): Promise<{ access_token: string; refresh_token: string; athlete: { id: number } }> {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  return res.json();
}

export async function runSetup() {
  console.log("\n  Strava MCP Server Setup\n");
  console.log("  First, create a Strava API app if you haven't already:");
  console.log("  https://www.strava.com/settings/api\n");
  console.log(`  Set the redirect URI to: ${REDIRECT_URI}\n`);

  const clientId = await ask("  Client ID: ");
  const clientSecret = await ask("  Client Secret: ");

  if (!clientId || !clientSecret) {
    console.error("\n  Both Client ID and Client Secret are required.");
    process.exit(1);
  }

  const authUrl = `${STRAVA_AUTH_URL}?client_id=${clientId}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=read,activity:read_all`;

  console.log("\n  Opening Strava in your browser to authorize...\n");
  openBrowser(authUrl);

  try {
    const code = await waitForCallback();
    console.log("  Authorization received. Exchanging for tokens...\n");

    const tokens = await exchangeCode(clientId, clientSecret, code);

    console.log("  Done! Run this command to add the server to Claude Code:\n");
    console.log(
      `  claude mcp add strava -e STRAVA_CLIENT_ID=${clientId} -e STRAVA_CLIENT_SECRET=${clientSecret} -e STRAVA_REFRESH_TOKEN=${tokens.refresh_token} -- npx -y @michaelhutchinson/strava-mcp-server\n`
    );
  } catch (err) {
    console.error(`\n  Setup failed: ${(err as Error).message}`);
    process.exit(1);
  }
}
