import {
  normalizeRadar,
  normalizeWarnings,
  freshness,
} from "../src/data/normalize";
import type { Envelope, RadarFrame, WarningEvent } from "../src/data/types";
type CacheStore = {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
};
type Options = {
  fetcher?: typeof fetch;
  cache?: CacheStore;
  now?: () => number;
};
const JMA = "https://www.jma.go.jp/bosai/";
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export function createApi(options: Options = {}) {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const memory = new Map<
    string,
    { value: Envelope<unknown>; expires: number }
  >();
  const pending = new Map<string, Promise<Envelope<unknown>>>();
  async function upstream(url: string) {
    const r = await fetcher(url, {
      signal: AbortSignal.timeout(15_000),
      redirect: "manual",
    });
    if (!r.ok) throw new Error(`上流データ取得失敗 (${r.status})`);
    return r;
  }
  async function source<T>(
    id: string,
    label: string,
    path: string,
    parse: (v: unknown) => T,
  ): Promise<Envelope<T>> {
    const cached = memory.get(id);
    if (cached && cached.expires > now()) return cached.value as Envelope<T>;
    if (pending.has(id)) return pending.get(id)! as Promise<Envelope<T>>;
    const task = (async () => {
      const key = new Request("https://amateras-cache.internal/" + id);
      let previous = cached?.value;
      if (!previous && options.cache) {
        try {
          const hit = await options.cache.match(key);
          if (hit) previous = (await hit.json()) as Envelope<unknown>;
        } catch {
          /* optional cache */
        }
      }
      if (
        !cached &&
        previous?.health.fetchedAt &&
        now() - Date.parse(previous.health.fetchedAt) < 60_000
      ) {
        memory.set(id, {
          value: previous,
          expires: Date.parse(previous.health.fetchedAt) + 60_000,
        });
        return previous;
      }
      try {
        const r = await upstream(JMA + path);
        const raw = await r.json();
        const data = parse(raw);
        const fetchedAt = new Date(now()).toISOString();
        const sourceTime =
          id === "radar"
            ? (data as RadarFrame[]).at(-1)!.timestamp
            : Array.isArray(raw)
              ? (raw as { controlDatetime: string }[]).reduce(
                  (last, r) =>
                    r.controlDatetime > last ? r.controlDatetime : last,
                  "",
                ) || null
              : null;
        const value: Envelope<T> = {
          data,
          health: {
            id,
            label,
            fetchedAt,
            sourceTime,
            state: freshness(id, sourceTime, fetchedAt, now()),
          },
        };
        memory.set(id, { value, expires: now() + 60_000 });
        if (options.cache)
          try {
            await options.cache.put(
              key,
              new Response(JSON.stringify(value), {
                headers: {
                  "Cache-Control": "max-age=86400",
                  "Content-Type": "application/json",
                },
              }),
            );
          } catch {
            /* data remains usable */
          }
        return value;
      } catch (e) {
        const value: Envelope<unknown> = {
          data: previous?.data ?? [],
          health: {
            id,
            label,
            fetchedAt: previous?.health.fetchedAt ?? null,
            sourceTime: previous?.health.sourceTime ?? null,
            state: "SOURCE ERROR",
            error: e instanceof Error ? e.message : "取得できません",
          },
        };
        memory.set(id, { value, expires: now() + 15_000 });
        return value;
      }
    })();
    pending.set(id, task);
    try {
      return (await task) as Envelope<T>;
    } finally {
      pending.delete(id);
    }
  }
  const radar = () =>
    source(
      "radar",
      "雨雲レーダー",
      "jmatile/data/nowc/targetTimes_N1.json",
      normalizeRadar,
    );
  const warnings = () =>
    source(
      "warnings",
      "気象警報・注意報",
      "warning/data/r8/map.json",
      normalizeWarnings,
    );
  async function asset(url: string, req: Request, ttl: number) {
    const key = new Request(req.url);
    if (options.cache) {
      const hit = await options.cache.match(key);
      if (hit) return hit;
    }
    const r = await upstream(url);
    const response = new Response(r.body, {
      headers: {
        "Content-Type":
          r.headers.get("Content-Type") ?? "application/octet-stream",
        "Cache-Control": `public,max-age=${ttl}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
    if (options.cache)
      try {
        await options.cache.put(key, response.clone());
      } catch {}
    return response;
  }
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url),
      path = url.pathname;
    if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
    try {
      if (path === "/api/radar") return json(await radar());
      if (path === "/api/warnings") return json(await warnings());
      if (path === "/api/health") {
        const values = await Promise.all([radar(), warnings()]);
        return json(values.map((v) => v.health));
      }
      const tile = path.match(
        /^\/api\/radar\/tiles\/(\d{14})\/(\d{14})\/(\d{1,2})\/(\d+)\/(\d+)\.png$/,
      );
      if (tile) {
        const [, base, valid, zs, xs, ys] = tile;
        const z = +zs,
          x = +xs,
          y = +ys;
        if (![4, 6, 8, 10].includes(z) || x >= 2 ** z || y >= 2 ** z)
          return json({ error: "Invalid tile" }, 400);
        const frames = await radar();
        if (
          !frames.data.some((f) => f.basetime === base && f.validtime === valid)
        )
          return json({ error: "Frame unavailable" }, 404);
        return await asset(
          `${JMA}jmatile/data/nowc/${base}/none/${valid}/surf/hrpns/${z}/${x}/${y}.png`,
          req,
          300,
        );
      }
      const geo = path.match(/^\/api\/areas\/(\d{7})$/);
      if (geo)
        return await asset(
          `${JMA}common/const/geojson/class20s/${geo[1]}.json`,
          req,
          86400,
        );
      return json({ error: "Not found" }, 404);
    } catch (e) {
      return json(
        { error: e instanceof Error ? e.message : "Upstream unavailable" },
        502,
      );
    }
  };
}
