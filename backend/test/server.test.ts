import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { createHttpServer, readServerConfig, shutdown } from "../src/server.ts";

describe("readServerConfig", () => {
  it("использует значения по умолчанию", () => {
    expect(readServerConfig({})).toEqual({
      host: "127.0.0.1",
      port: 4010,
      frontendOrigin: "http://localhost:5173",
    });
  });

  it("читает значения из окружения", () => {
    expect(
      readServerConfig({
        PORT: "8080",
        HOST: "0.0.0.0",
        FRONTEND_ORIGIN: "https://app.example",
      }),
    ).toEqual({
      host: "0.0.0.0",
      port: 8080,
      frontendOrigin: "https://app.example",
    });
  });

  it("невалидный PORT выбрасывает ошибку", () => {
    expect(() => readServerConfig({ PORT: "abc" })).toThrow('Invalid PORT value: "abc"');
    expect(() => readServerConfig({ PORT: "70000" })).toThrow();
    expect(() => readServerConfig({ PORT: "1.5" })).toThrow();
  });
});

describe("HTTP server lifecycle", () => {
  it("стартует, отвечает на /health и корректно закрывается", async () => {
    const server = createHttpServer({
      host: "127.0.0.1",
      port: 0,
      frontendOrigin: "http://localhost:5173",
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");

    const address = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${address.port}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });

    const closed = once(server, "close");
    shutdown(server, () => {});
    await closed;
  });
});
