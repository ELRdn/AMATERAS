import { it, expect, vi, describe } from "vitest";
import { readFileSync } from "node:fs";
import {
  normalizeEarthquakes,
  parseTyphoonXml,
  jmaTime,
} from "../src/data/events";
import { createEventService } from "../server/events";
const raw = JSON.parse(
  readFileSync("tests/fixtures/earthquake-jma.json", "utf8"),
);
const xml = readFileSync("tests/fixtures/typhoon-vptw61.xml", "utf8");
const NOW = Date.parse("2026-09-06T14:00:00Z"),
  AT = new Date(NOW).toISOString();
const URL =
  "https://www.data.jma.go.jp/developer/xml/data/20260906124126_0_VPTW61_010000.xml";
const target = [
  {
    tropicalCyclone: "TC2628",
    typhoonNumber: "2624",
    category: "TS",
    issue: "2026-09-06T21:45:00+09:00",
  },
];
const feed = (url = URL) =>
  "<feed><updated>" +
  AT +
  '</updated><entry><link href="' +
  url +
  '"/></entry></feed>';
function upstream() {
  return vi.fn(async (url: string | URL | Request) => {
    const u = String(url);
    if (u.endsWith("list.json")) return Response.json(raw);
    if (u.endsWith("targetTc.json")) return Response.json(target);
    if (u.includes("/feed/")) return new Response(feed());
    if (u === URL) return new Response(xml);
    return new Response("", { status: 404 });
  });
}
describe("captured official earthquake JSON", () => {
  it("accepts string serials and ISO/JST times with longitude first", () => {
    const e = normalizeEarthquakes(raw, NOW, AT)[0];
    expect(e.position).toEqual([140.5, 35.9]);
    expect(e.depthKm).toBe(40);
    expect(e.magnitude).toBe(3.2);
    expect(e.occurredAt).toBe("2026-09-06T10:28:00.000Z");
    expect(e.title).toBe("千葉県北東部");
    expect(e.source.url).toMatch(
      /^https:\/\/www.jma.go.jp\/bosai\/quake\/data\//,
    );
  });
  it("orders corrections by report time before serial across bulletin types", () => {
    const r = raw[0],
      next = { ...r, ser: "1", rdt: "2026-09-06T19:40:00+09:00", mag: "3.4" };
    const e = normalizeEarthquakes([{ ...r, ser: "9" }, next], NOW, AT);
    expect(e).toHaveLength(1);
    expect(e[0].magnitude).toBe(3.4);
  });
  it("retains cancellation and never resurrects the earlier event", () => {
    const r = raw[0],
      cancel = {
        ...r,
        ift: "取消",
        rdt: "2026-09-06T19:40:00+09:00",
        at: undefined,
        cod: undefined,
      };
    expect(normalizeEarthquakes([cancel, r], NOW, AT)[0].status).toBe(
      "cancelled",
    );
  });
  it("keeps missing coordinates/magnitude/unknown intensity as null", () => {
    const e = normalizeEarthquakes(
      [{ ...raw[0], cod: "", mag: "不明", maxi: "99" }],
      NOW,
      AT,
    )[0];
    expect(e.position).toBeNull();
    expect(e.magnitude).toBeNull();
    expect(e.maxIntensity).toBeNull();
  });
  it("excludes test, training, EEW, future and old records", () => {
    const r = raw[0];
    expect(
      normalizeEarthquakes(
        [
          { ...r, ift: "訓練" },
          { ...r, ift: "試験" },
          { ...r, ttl: "緊急地震速報" },
          { ...r, at: "2026-09-07T19:00:00+09:00" },
          { ...r, at: "2026-09-04T19:00:00+09:00" },
        ],
        NOW,
        AT,
      ),
    ).toEqual([]);
  });
  it("rejects changed schema and invalid report time but accepts a real empty list", () => {
    expect(() => normalizeEarthquakes({}, NOW, AT)).toThrow();
    expect(() =>
      normalizeEarthquakes([{ ...raw[0], rdt: "bad" }], NOW, AT),
    ).toThrow();
    expect(normalizeEarthquakes([], NOW, AT)).toEqual([]);
  });
  it("parses compact Japanese report timestamps with the correct offset", () =>
    expect(jmaTime("20260906193122")).toBe("2026-09-06T10:31:22.000Z"));
});
describe("captured VPTW61 XML", () => {
  it("reads attributes, repeated Kind nodes, forecasts and asymmetric wind axes", () => {
    const e = parseTyphoonXml(xml, URL, AT)!;
    expect(e.id).toBe("TC2628");
    expect(e.name).toBe("クロヴァン");
    expect(e.current?.position).toEqual([130.7, 25.9]);
    expect(e.current?.pressure).toBe(990);
    expect(e.current?.wind).toBe(18);
    expect(e.forecast).toHaveLength(2);
    expect(e.forecast[0].forecastRadiusKm).toBe(65);
    expect(e.forecast[0].position).toEqual([132.1, 26.6]);
    expect(e.forecast[0].wind).toBeNull();
    expect(e.windAreas).toEqual([
      {
        kind: "gale",
        center: [130.7, 25.9],
        direction: "南西",
        radiusKm: 440,
        oppositeRadiusKm: 330,
      },
    ]);
    expect(e.detailState).toBe("LIVE");
  });
  it("converts nautical miles and knots only when metric fields are absent", () => {
    const x = xml
      .replace(
        /<jmx_eb:Radius[^>]*unit="km"[^>]*(?:\/>|>[^<]*<\/jmx_eb:Radius>)/g,
        "",
      )
      .replace(
        /<jmx_eb:WindSpeed[^>]*unit="m\/s"[^>]*(?:\/>|>[^<]*<\/jmx_eb:WindSpeed>)/g,
        "",
      );
    const e = parseTyphoonXml(x, URL, AT)!;
    expect(e.forecast[0].forecastRadiusKm).toBeCloseTo(35 * 1.852);
    expect(e.current?.wind).toBeCloseTo(35 * 0.514444);
    expect(e.windAreas[0].radiusKm).toBeCloseTo(240 * 1.852);
  });
  it("uses the actual numeric degree-minute coordinates when degrees are absent", () => {
    const x = xml.replace(
      /<jmx_eb:(Coordinate|BasePoint)[^>]*type="中心位置（度）"[^>]*>[\s\S]*?<\/jmx_eb:\1>/g,
      "",
    );
    const e = parseTyphoonXml(x, URL, AT)!;
    expect(e.current?.position[0]).toBeCloseTo(130 + 40 / 60);
    expect(e.current?.position[1]).toBeCloseTo(25 + 55 / 60);
  });
  it("does not invent a radius for unsupported or incomplete wind axes", () => {
    const e = parseTyphoonXml(
      xml.replace(">南西</jmx_eb:Direction>", ">不明</jmx_eb:Direction>"),
      URL,
      AT,
    )!;
    expect(e.windAreas).toEqual([]);
    expect(e.detailState).toBe("PARTIAL");
  });
  it("ignores non-normal bulletins and accepts cancellation without a body", () => {
    expect(
      parseTyphoonXml(
        xml.replace("<Status>通常</Status>", "<Status>訓練</Status>"),
        URL,
        AT,
      ),
    ).toBeNull();
    const x = xml
      .replace("<InfoType>発表</InfoType>", "<InfoType>取消</InfoType>")
      .replace(/<Body[\s\S]*?<\/Body>/, "");
    expect(parseTyphoonXml(x, URL, AT)?.status).toBe("cancelled");
  });
  it("rejects malformed XML, entities and missing observed coordinates", () => {
    expect(() => parseTyphoonXml("<Report>", URL, AT)).toThrow();
    expect(() =>
      parseTyphoonXml('<!DOCTYPE Report [<!ENTITY x "foo">]>' + xml, URL, AT),
    ).toThrow();
    expect(() =>
      parseTyphoonXml(
        xml.replace(/<jmx_eb:Coordinate[\s\S]*?<\/jmx_eb:Coordinate>/g, ""),
        URL,
        AT,
      ),
    ).toThrow();
  });
});
describe("independent cached event sources", () => {
  it("deduplicates requests and preserves a successful snapshot on failure", async () => {
    let time = NOW;
    const f = upstream(),
      api = createEventService({ fetcher: f as typeof fetch, now: () => time });
    const [a, b] = await Promise.all([api.earthquakes(), api.earthquakes()]);
    expect(a).toEqual(b);
    expect(f).toHaveBeenCalledTimes(1);
    time += 61000;
    f.mockRejectedValue(new Error("offline"));
    const failed = await api.earthquakes();
    expect(failed.health.state).toBe("SOURCE ERROR");
    expect(failed.data).toEqual(a.data);
    expect(failed.health.fetchedAt).toBe(a.health.fetchedAt);
  });
  it("distinguishes unavailable target lists from an official zero with no feed downloads", async () => {
    const f = vi.fn(async () => Response.json([]));
    const e = await createEventService({
      fetcher: f,
      now: () => NOW,
    }).typhoons();
    expect(e.health.state).toBe("LIVE");
    expect(e.data).toEqual([]);
    expect(f).toHaveBeenCalledTimes(1);
    const failed = await createEventService({
      fetcher: vi.fn().mockRejectedValue(new Error("offline")),
      now: () => NOW,
    }).typhoons();
    expect(failed.health.state).toBe("SOURCE ERROR");
    expect(failed.health.fetchedAt).toBeNull();
  });
  it("uses actual target IDs, caches immutable XML and retains its fetch time", async () => {
    let time = NOW;
    const f = upstream(),
      api = createEventService({ fetcher: f as typeof fetch, now: () => time });
    const first = await api.typhoons();
    expect(first.health.state).toBe("LIVE");
    expect(first.data[0].name).toBe("クロヴァン");
    time += 61000;
    const second = await api.typhoons();
    expect(f.mock.calls.filter(([u]) => String(u) === URL)).toHaveLength(1);
    expect(second.data[0].source.fetchedAt).toBe(
      first.data[0].source.fetchedAt,
    );
  });
  it("reports partial details and recovers after a failed report download", async () => {
    let time = NOW;
    const base = upstream();
    let bad = true;
    const f = vi.fn(async (u: any, init: any) =>
      bad && String(u) === URL ? new Response("", { status: 503 }) : base(u),
    );
    const api = createEventService({ fetcher: f, now: () => time });
    const a = await api.typhoons();
    expect(a.health.state).toBe("PARTIAL");
    expect(a.data[0].current).toBeNull();
    bad = false;
    time += 61000;
    const b = await api.typhoons();
    expect(b.health.state).toBe("LIVE");
    expect(b.data[0].current).not.toBeNull();
  });
  it("does not cache malformed XML and recovers on the next check", async () => {
    let time = NOW;
    const base = upstream();
    let bad = true;
    const f = vi.fn(async (u: any, init: any) =>
      bad && String(u) === URL ? new Response("<Report>") : base(u),
    );
    const api = createEventService({ fetcher: f, now: () => time });
    const a = await api.typhoons();
    expect(a.health.state).toBe("PARTIAL");
    expect(a.data[0].current).toBeNull();
    bad = false;
    time += 61000;
    const b = await api.typhoons();
    expect(b.health.state).toBe("LIVE");
    expect(b.data[0].current).not.toBeNull();
  });
  it("does not label older detailed forecasts as current", async () => {
    const f = upstream();
    const impl = f.getMockImplementation()!;
    f.mockImplementation(async (u) =>
      String(u).endsWith("targetTc.json")
        ? Response.json([{ ...target[0], issue: "2026-09-06T23:45:00+09:00" }])
        : impl(u),
    );
    const a = await createEventService({
      fetcher: f as typeof fetch,
      now: () => NOW,
    }).typhoons();
    expect(a.health.state).toBe("PARTIAL");
    expect(a.data[0].detailError).toContain("更新待ち");
  });
  it("never fetches unapproved URLs or follows upstream redirects", async () => {
    const f = vi.fn(async (u: any, init: any) => {
      expect(init.redirect).toBe("manual");
      if (String(u).endsWith("targetTc.json")) return Response.json(target);
      return new Response(feed("https://evil.example/secret"));
    });
    const a = await createEventService({
      fetcher: f,
      now: () => NOW,
    }).typhoons();
    expect(a.health.state).toBe("PARTIAL");
    expect(f.mock.calls.some(([u]) => String(u).includes("evil.example"))).toBe(
      false,
    );
    const api = createEventService({
      fetcher: vi.fn().mockResolvedValue(new Response(null, { status: 302 })),
      now: () => NOW,
    });
    expect((await api.earthquakes()).health.state).toBe("SOURCE ERROR");
  });
  it("preserves PARTIAL across a restart using the edge snapshot", async () => {
    const items = new Map<string, Response>();
    const cache = {
      match: async (r: Request) => items.get(r.url)?.clone(),
      put: async (r: Request, v: Response) => {
        items.set(r.url, v.clone());
      },
    };
    const f = vi.fn(async (u: any) =>
      String(u).endsWith("targetTc.json")
        ? Response.json(target)
        : new Response("", { status: 500 }),
    );
    expect(
      (
        await createEventService({
          fetcher: f,
          cache,
          now: () => NOW,
        }).typhoons()
      ).health.state,
    ).toBe("PARTIAL");
    const next = await createEventService({
      fetcher: f,
      cache,
      now: () => NOW + 1000,
    }).typhoons();
    expect(next.health.state).toBe("PARTIAL");
  });
});
