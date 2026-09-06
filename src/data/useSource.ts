import { useCallback, useEffect, useRef, useState } from "react";
import type { Envelope } from "./types";
import { freshness } from "./normalize";
export function useSource<T>(
  id: string,
  label: string,
  initial: T,
  fixture?: T,
) {
  const [value, setValue] = useState<Envelope<T>>({
    data: initial,
    health: {
      id,
      label,
      state: "SOURCE ERROR",
      fetchedAt: null,
      sourceTime: null,
    },
  });
  const [loading, setLoading] = useState(true);
  const busy = useRef(false);
  const alive = useRef(true);
  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      if (
        import.meta.env.DEV &&
        new URLSearchParams(location.search).get("fault") === id
      )
        throw new Error("開発用の通信障害シナリオ");
      if (fixture !== undefined) {
        setValue({
          data: fixture,
          health: {
            id,
            label,
            state: "LIVE",
            fetchedAt: new Date().toISOString(),
            sourceTime: new Date().toISOString(),
          },
        });
        return;
      }
      const r = await fetch("/api/" + id, {
        signal: AbortSignal.timeout(20_000),
      });
      if (!r.ok) throw new Error("データを取得できません");
      const data = (await r.json()) as Envelope<T>;
      if (!data.health || !Array.isArray(data.data))
        throw new Error("データ形式が変わりました");
      if (alive.current)
        setValue((prev) =>
          data.health.state === "SOURCE ERROR" &&
          !data.health.fetchedAt &&
          prev.health.fetchedAt
            ? {
                data: prev.data,
                health: {
                  ...prev.health,
                  state: "SOURCE ERROR",
                  error: data.health.error,
                },
              }
            : data,
        );
    } catch (e) {
      if (alive.current)
        setValue((prev) => ({
          ...prev,
          health: {
            ...prev.health,
            state: "SOURCE ERROR",
            error: e instanceof Error ? e.message : "接続エラー",
          },
        }));
    } finally {
      busy.current = false;
      if (alive.current) setLoading(false);
    }
  }, [id, label, fixture]);
  useEffect(() => {
    alive.current = true;
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 60_000);
    const visible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive.current = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);
  useEffect(() => {
    const timer = setInterval(
      () =>
        setValue((prev) =>
          prev.health.state === "SOURCE ERROR"
            ? prev
            : {
                ...prev,
                health: {
                  ...prev.health,
                  state: freshness(
                    id,
                    prev.health.sourceTime,
                    prev.health.fetchedAt,
                  ),
                },
              },
        ),
      10_000,
    );
    return () => clearInterval(timer);
  }, [id]);
  return { ...value, loading, refresh };
}
