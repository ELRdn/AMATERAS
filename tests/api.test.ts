import { it, expect, vi } from "vitest";
import { createApi } from "../server/api";
const raw = [
  {
    basetime: "20260906010000",
    validtime: "20260906010000",
    elements: ["hrpns"],
  },
];
const request = (path: string) => new Request("https://amateras.test" + path);
it("uses edge-compatible manual redirects and rejects upstream redirects", async () => {
  const fetcher = vi.fn().mockImplementation(async (_url, init) => {
    expect(init.redirect).toBe("manual");
    return new Response(null, {
      status: 302,
      headers: { Location: "https://example.com" },
    });
  });
  const result = await (
    await createApi({ fetcher })(request("/api/radar"))
  ).json();
  expect(result.health.state).toBe("SOURCE ERROR");
  expect(result.health.error).toContain("302");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("retains last successful data with an explicit source error", async () => {
  let time = Date.parse("2026-09-06T01:01:00Z");
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json(raw))
    .mockRejectedValueOnce(new Error("offline"));
  const api = createApi({ fetcher, now: () => time });
  const first = await (await api(request("/api/radar"))).json();
  expect(first.health.state).toBe("LIVE");
  time += 61e3;
  const failed = await (await api(request("/api/radar"))).json();
  expect(failed.data).toEqual(first.data);
  expect(failed.health.fetchedAt).toBe(first.health.fetchedAt);
  expect(failed.health.state).toBe("SOURCE ERROR");
});
it("collapses concurrent upstream requests", async () => {
  const fetcher = vi.fn().mockImplementation(async () => Response.json(raw));
  const api = createApi({ fetcher });
  await Promise.all([api(request("/api/radar")), api(request("/api/radar"))]);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("isolates a broken warning source from radar", async () => {
  const fetcher = vi
    .fn()
    .mockImplementation(async (url: string) =>
      url.includes("nowc")
        ? Response.json(raw)
        : Response.json({ changed: true }),
    );
  const api = createApi({ fetcher });
  const r = await (await api(request("/api/radar"))).json();
  const w = await (await api(request("/api/warnings"))).json();
  expect(r.data.length).toBe(1);
  expect(w.health.state).toBe("SOURCE ERROR");
  expect(w.health.fetchedAt).toBeNull();
});
it("does not expose an arbitrary URL proxy", async () => {
  const fetcher = vi.fn();
  const api = createApi({ fetcher });
  expect(
    (await api(request("/api/proxy?url=https://example.com"))).status,
  ).toBe(404);
  expect(fetcher).not.toHaveBeenCalled();
});
it("rejects invalid coordinates and unknown frames", async () => {
  const api = createApi({
    fetcher: vi.fn().mockImplementation(async () => Response.json(raw)),
  });
  expect(
    (
      await api(
        request("/api/radar/tiles/20260906010000/20260906010000/10/9999/0.png"),
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await api(
        request("/api/radar/tiles/20260906000000/20260906000000/4/14/6.png"),
      )
    ).status,
  ).toBe(404);
});
it("rejects mutation methods", async () => {
  expect(
    (
      await createApi()(
        new Request("https://amateras.test/api/radar", { method: "POST" }),
      )
    ).status,
  ).toBe(405);
});
