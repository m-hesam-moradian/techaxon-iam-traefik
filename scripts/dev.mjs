import { spawn, spawnSync } from "node:child_process";

const portForwardingDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN ?? "app.github.dev";
const codespaceName = process.env.CODESPACE_NAME;
const frontendUrl =
  process.env.DEV_FRONTEND_URL ??
  (codespaceName
    ? `https://${codespaceName}-3001.${portForwardingDomain}`
    : "http://localhost:3001");
const iamUrl =
  process.env.DEV_IAM_URL ??
  (codespaceName
    ? `https://${codespaceName}-3000.${portForwardingDomain}`
    : "http://localhost:3000");
const cookieDomain = codespaceName ? `.${portForwardingDomain}` : ".techaxon.localhost";

const environment = {
  ...process.env,
  HOSTNAME: "0.0.0.0",
  NEXT_PUBLIC_IAM_BASE_URL: "/iam",
  IAM_INTERNAL_URL: "http://127.0.0.1:3000",
  OIDC_WEB_REDIRECT_URI: `${frontendUrl}/callback`,
  CORS_ALLOWED_ORIGINS: frontendUrl,
  COOKIE_DOMAIN: cookieDomain,
  COOKIE_SECURE: codespaceName ? "true" : process.env.COOKIE_SECURE ?? "false",
};

console.log(`Frontend: ${frontendUrl}`);
console.log(`IAM API:  ${iamUrl}`);
console.log("Starting Docker infrastructure, IAM, and frontend...\n");

const dockerResult = spawnSync("docker", ["compose", "up", "-d"], {
  env: environment,
  stdio: "inherit",
});

if (dockerResult.status !== 0) {
  process.exit(dockerResult.status ?? 1);
}

const services = spawn(
  "pnpm",
  [
    "exec",
    "concurrently",
    "-k",
    "-n",
    "IAM,FRONTEND",
    "-c",
    "cyan,magenta",
    '"pnpm --filter techaxon-iam start:dev"',
    '"pnpm --filter frontend-next dev -p 3001 --hostname 0.0.0.0"',
  ],
  { env: environment, stdio: "inherit" },
);

const stop = () => services.kill("SIGINT");
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
services.on("exit", (code) => process.exit(code ?? 0));
