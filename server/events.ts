import { XMLParser, XMLValidator } from "fast-xml-parser";
import { z } from "zod";
import { normalizeEarthquakes, parseTyphoonXml } from "../src/data/events";
import type {
  Envelope,
  EarthquakeEvent,
  TyphoonEvent,
  TyphoonPoint,
  HealthState,
} from "../src/data/types";
type CacheStore = {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
};
type Options = {
  fetcher?: typeof fetch;
  now?: () => number;
  cache?: CacheStore;
};
const ROOT = "https://www.data.jma.go.jp/developer/xml/";
const QUAKE = "https://www.jma.go.jp/bosai/quake/data/list.json",
  TARGET = "https://www.jma.go.jp/bosai/typhoon/data/targetTc.json";
const allowedReport =
  /^https:\/\/www\.data\.jma\.go\.jp\/developer\/xml\/data\/\d{14}_\d+_VPTW61_\d+\.xml$/;
const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  removeNSPrefix: true,
  processEntities: false,
});
const arr = (v: any): any[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
const targetSchema = z.array(
  z.object({
    tropicalCyclone: z.string().regex(/^TC\d+$/),
    typhoonNumber: z.string(),
    category: z.string(),
    issue: z.iso.datetime({ offset: true }),
  }),
);
interface Report {
  xml: string;
  fetchedAt: string;
}
export function createEventService(options: Options = {}) {
  const fetcher = options.fetcher ?? fetch,
    now = options.now ?? Date.now;
  const memory = new Map<
    string,
    { value: Envelope<unknown[]>; expires: number }
  >();
  const pending = new Map<string, Promise<Envelope<unknown[]>>>();
  const snapshots = new Map<string, Envelope<unknown[]>>();
  const reports = new Map<string, Report>();
  let longUrls: string[] = [];
  let longAt = 0;
  async function upstream(url: string, signal: AbortSignal) {
    const r = await fetcher(url, { signal, redirect: "manual" });
    if (!r.ok) throw new Error("気象庁データ取得失敗 (" + r.status + ")");
    return r;
  }
  async function put(key: Request, r: Response) {
    try {
      await options.cache?.put(key, r);
    } catch {
      /* optional persistent cache */
    }
  }
  async function source<T>(
    id: string,
    label: string,
    load: (
      previous: T[] | undefined,
      signal: AbortSignal,
    ) => Promise<{
      data: T[];
      state?: HealthState;
      sourceTime: string | null;
      error?: string;
    }>,
  ): Promise<Envelope<T[]>> {
    const cached = memory.get(id);
    if (cached && cached.expires > now()) return cached.value as Envelope<T[]>;
    if (pending.has(id)) return pending.get(id)! as Promise<Envelope<T[]>>;
    const task = (async () => {
      const key = new Request("https://amateras-cache.internal/events/" + id);
      let previous = snapshots.get(id) as Envelope<T[]> | undefined;
      if (!previous) {
        try {
          const hit = await options.cache?.match(key);
          if (hit) previous = (await hit.json()) as Envelope<T[]>;
        } catch {}
      }
      if (
        previous?.health.fetchedAt &&
        now() - Date.parse(previous.health.fetchedAt) < 60000
      ) {
        snapshots.set(id, previous);
        memory.set(id, {
          value: previous,
          expires: Date.parse(previous.health.fetchedAt) + 60000,
        });
        return previous;
      }
      const checkedAt = new Date(now()).toISOString();
      try {
        const result = await load(previous?.data, AbortSignal.timeout(18000));
        const value: Envelope<T[]> = {
          data: result.data,
          health: {
            id,
            label,
            state: result.state ?? "LIVE",
            sourceTime: result.sourceTime,
            fetchedAt: new Date(now()).toISOString(),
            checkedAt,
            ...(result.error ? { error: result.error } : {}),
          },
        };
        snapshots.set(id, value);
        memory.set(id, { value, expires: now() + 60000 });
        await put(
          key,
          new Response(JSON.stringify(value), {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "max-age=86400",
            },
          }),
        );
        return value;
      } catch (e) {
        const value: Envelope<T[]> = {
          data: previous?.data ?? [],
          health: {
            id,
            label,
            state: "SOURCE ERROR",
            sourceTime: previous?.health.sourceTime ?? null,
            fetchedAt: previous?.health.fetchedAt ?? null,
            checkedAt,
            error: e instanceof Error ? e.message : "情報を取得できません",
          },
        };
        memory.set(id, { value, expires: now() + 15000 });
        if (previous) snapshots.set(id, previous);
        return value;
      }
    })();
    pending.set(id, task);
    try {
      return await task;
    } finally {
      pending.delete(id);
    }
  }
  function feed(xml: string): string[] {
    if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true)
      throw new Error("台風フィードの形式が変わりました");
    const f = parser.parse(xml)?.feed;
    if (!f || !f.updated) throw new Error("台風フィードの形式が変わりました");
    return arr(f.entry)
      .flatMap((e) => arr(e.link).map((l) => l?.["@_href"]))
      .filter(
        (url): url is string =>
          typeof url === "string" && allowedReport.test(url),
      );
  }
  async function report(url: string, signal: AbortSignal): Promise<Report> {
    const mem = reports.get(url);
    if (mem) return mem;
    let value: Report | undefined;
    try {
      const cached = await options.cache?.match(new Request(url));
      if (cached) {
        const at = cached.headers.get("X-Amateras-Fetched-At");
        if (at) {
          const candidate = { xml: await cached.text(), fetchedAt: at };
          parseTyphoonXml(candidate.xml, url, candidate.fetchedAt);
          value = candidate;
        }
      }
    } catch {}
    if (!value) {
      const r = await upstream(url, signal);
      value = { xml: await r.text(), fetchedAt: new Date(now()).toISOString() };
      parseTyphoonXml(value.xml, url, value.fetchedAt);
      await put(
        new Request(url),
        new Response(value.xml, {
          headers: {
            "Cache-Control": "max-age=604800",
            "Content-Type": "application/xml",
            "X-Amateras-Fetched-At": value.fetchedAt,
          },
        }),
      );
    }
    reports.set(url, value);
    while (reports.size > 128) reports.delete(reports.keys().next().value!);
    return value;
  }
  const earthquakes = () =>
    source<EarthquakeEvent>(
      "earthquakes",
      "地震情報",
      async (_previous, signal) => {
        const data = normalizeEarthquakes(
          await (await upstream(QUAKE, signal)).json(),
          now(),
          new Date(now()).toISOString(),
        );
        const sourceTime =
          data
            .map((e) => e.source.issuedAt)
            .sort()
            .at(-1) ?? null;
        return { data, sourceTime };
      },
    );
  const typhoons = () =>
    source<TyphoonEvent>("typhoons", "台風情報", async (previous, signal) => {
      const raw = targetSchema.safeParse(
        await (await upstream(TARGET, signal)).json(),
      );
      if (!raw.success) throw new Error("台風の現行一覧の形式が変わりました");
      const current = raw.data;
      if (!current.length) return { data: [], sourceTime: null };
      const issues: string[] = [];
      let urls: string[] = [];
      const needLong = !longAt || now() - longAt >= 3600000;
      await Promise.all([
        (async () => {
          try {
            urls.push(
              ...feed(
                await (await upstream(ROOT + "feed/extra.xml", signal)).text(),
              ),
            );
          } catch {
            issues.push("更新フィードを取得できません");
          }
        })(),
        (async () => {
          if (needLong) {
            try {
              longUrls = feed(
                await (
                  await upstream(ROOT + "feed/extra_l.xml", signal)
                ).text(),
              );
              longAt = now();
            } catch {
              issues.push("補完フィードを取得できません");
            }
          }
        })(),
      ]);
      urls = [...new Set([...urls, ...longUrls])].sort().reverse().slice(0, 24);
      const parsed: TyphoonEvent[] = [];
      let cursor = 0;
      await Promise.all(
        Array.from({ length: 4 }, async () => {
          while (cursor < urls.length) {
            const url = urls[cursor++];
            try {
              const r = await report(url, signal);
              const e = parseTyphoonXml(r.xml, url, r.fetchedAt);
              if (e) parsed.push(e);
            } catch {
              issues.push("一部の台風電文を取得・解釈できません");
            }
          }
        }),
      );
      const data: TyphoonEvent[] = [];
      for (const c of current) {
        const id = c.tropicalCyclone,
          prev = previous?.find((p) => p.id === id);
        const versions = parsed.filter((p) => p.id === id);
        if (prev) versions.unshift(prev);
        versions.sort(
          (a, b) =>
            Date.parse(a.source.issuedAt) - Date.parse(b.source.issuedAt) ||
            a.serial - b.serial,
        );
        const latest = versions.at(-1);
        if (latest?.status === "cancelled") continue;
        if (!latest) {
          issues.push("最新の台風詳細がありません");
          data.push({
            id,
            number: c.typhoonNumber,
            name: id,
            category: c.category,
            status: "active",
            serial: 0,
            source: {
              organization: "気象庁",
              url: TARGET,
              issuedAt: c.issue,
              observedAt: null,
              fetchedAt: new Date(now()).toISOString(),
            },
            current: null,
            track: [],
            forecast: [],
            windAreas: [],
            detailState: "PARTIAL",
            detailError: "最新の台風詳細を取得できません",
          });
          continue;
        }
        const points = new Map<string, TyphoonPoint>();
        for (const v of versions)
          for (const p of v.track)
            if (
              Date.parse(p.time) >= now() - 72 * 3600000 &&
              Date.parse(p.time) <= now()
            )
              points.set(p.time, p);
        const old = Date.parse(latest.source.issuedAt) < Date.parse(c.issue);
        const partial =
          old || latest.detailState === "PARTIAL" || issues.length > 0;
        data.push({
          ...latest,
          number: c.typhoonNumber,
          track: [...points.values()].sort((a, b) =>
            a.time.localeCompare(b.time),
          ),
          detailState: partial ? "PARTIAL" : "LIVE",
          ...(partial
            ? {
                detailError: old
                  ? "台風詳細の更新待ち"
                  : (latest.detailError ?? issues[0]),
              }
            : { detailError: undefined }),
        });
      }
      const partial =
        issues.length > 0 || data.some((e) => e.detailState === "PARTIAL");
      return {
        data,
        state: partial ? "PARTIAL" : "LIVE",
        sourceTime:
          current
            .map((c) => c.issue)
            .sort()
            .at(-1) ?? null,
        ...(partial
          ? {
              error:
                [...new Set(issues)].join(" / ") || "台風詳細の更新を確認中",
            }
          : {}),
      };
    });
  return { earthquakes, typhoons };
}
