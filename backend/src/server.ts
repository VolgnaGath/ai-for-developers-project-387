import { createServer, type Server } from "node:http";
import { pathToFileURL } from "node:url";
import { DEFAULT_FRONTEND_ORIGIN, createApp } from "./app.ts";
import { systemClock } from "./clock.ts";
import { createIdGenerator } from "./ids.ts";
import { createStore } from "./store.ts";

export const DEFAULT_PORT = 4010;
export const DEFAULT_HOST = "127.0.0.1";

export interface ServerConfig {
  host: string;
  port: number;
  frontendOrigin: string;
  frontendDist?: string;
}

export function readServerConfig(env: NodeJS.ProcessEnv): ServerConfig {
  const rawPort = env.PORT ?? String(DEFAULT_PORT);
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }
  return {
    host: env.HOST ?? DEFAULT_HOST,
    port,
    frontendOrigin: env.FRONTEND_ORIGIN ?? DEFAULT_FRONTEND_ORIGIN,
    frontendDist: env.FRONTEND_DIST,
  };
}

export function createHttpServer(config: ServerConfig): Server {
  const app = createApp({
    store: createStore({ clock: systemClock, ids: createIdGenerator() }),
    clock: systemClock,
    frontendOrigin: config.frontendOrigin,
    frontendDist: config.frontendDist,
  });
  return createServer(app);
}

export function shutdown(server: Server, exit: (code?: number) => void = process.exit): void {
  server.closeIdleConnections();
  server.close(() => exit(0));
}

export function main(env: NodeJS.ProcessEnv = process.env): void {
  const config = readServerConfig(env);
  const server = createHttpServer(config);

  server.listen(config.port, config.host, () => {
    console.log(`Backend listening on http://${config.host}:${config.port}`);
  });

  let shuttingDown = false;
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`Received ${signal}, shutting down`);
      shutdown(server);
    });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
