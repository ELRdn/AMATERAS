import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Settings2,
  Radio,
  Map as MapIcon,
  Layers,
  Info,
  Play,
  Pause,
  RefreshCw,
  Sun,
  Moon,
  Maximize,
  Plus,
  Minus,
  ChevronRight,
  ChevronDown,
  X,
  CloudRain,
  Zap,
  Mountain,
  Waves,
  TriangleAlert,
  LocateFixed,
  Check,
  ArrowUpRight,
  Clock3,
} from "lucide-react";
import { WeatherMap, type MapAction } from "./map/WeatherMap";
import { Modal } from "./components/Modal";
import { useSource } from "./data/useSource";
import { makeFixture, makeRadarFixture } from "./data/fixtures";
import {
  dateJst,
  timeJst,
  WARNING_COLORS,
  type PlaceResult,
  type RadarFrame,
  type WarningEvent,
} from "./data/types";
const categories = [
  { id: "rain", name: "大雨", icon: CloudRain },
  { id: "landslide", name: "土砂災害", icon: Mountain },
  { id: "thunder", name: "雷", icon: Zap },
  { id: "tide", name: "高潮", icon: Waves },
];
const scenario = import.meta.env.DEV
  ? new URLSearchParams(location.search).get("scenario")
  : null;
const fixture =
  scenario && ["quiet", "rainy", "severe"].includes(scenario)
    ? makeFixture(scenario)
    : undefined;
const fixtureFrames = fixture ? makeRadarFixture(scenario!) : undefined;
const emptyWarnings: WarningEvent[] = [],
  emptyFrames: RadarFrame[] = [];
function App() {
  const [compact, setCompact] = useState(
    () => window.matchMedia("(max-width:1150px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width:1150px)");
    const changed = () => setCompact(media.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  const [theme, setTheme] = useState<"dark" | "light">("dark"),
    [terrain, setTerrain] = useState(false),
    [radarVisible, setRadarVisible] = useState(scenario !== "quiet"),
    [opacity, setOpacity] = useState(0.72);
  const [places, setPlaces] = useState<PlaceResult[]>([]),
    [query, setQuery] = useState(""),
    [searchOpen, setSearchOpen] = useState(false),
    [searchIndex, setSearchIndex] = useState(0);
  const [listLimit, setListLimit] = useState(80);
  const [filter, setFilter] = useState("all"),
    [selected, setSelected] = useState<string | null>(null),
    [action, setAction] = useState<MapAction | null>(null),
    [modal, setModal] = useState<"legend" | "settings" | "sources" | null>(
      null,
    );
  const [sheet, setSheet] = useState(false),
    [timelineOpen, setTimelineOpen] = useState(false),
    [playing, setPlaying] = useState(false),
    [requested, setRequested] = useState<string | null>(null),
    [displayed, setDisplayed] = useState<RadarFrame | undefined>(),
    [frameReady, setFrameReady] = useState(false),
    [mapError, setMapError] = useState(""),
    [camera, setCamera] = useState("JAPAN / 全国"),
    [now, setNow] = useState(new Date().toISOString());
  const rain = useSource("radar", "雨雲レーダー", emptyFrames, fixtureFrames),
    warnings = useSource(
      "warnings",
      "気象警報・注意報",
      emptyWarnings,
      fixture,
    );
  const placeMap = useMemo(
    () => new Map(places.map((p) => [p.code, p])),
    [places],
  );
  const frames = rain.data;
  const frame = frames.find((f) => f.id === requested) ?? frames.at(-1);
  const frameIndex = frame ? frames.findIndex((f) => f.id === frame.id) : 0;
  const nextFrame = frames[(frameIndex + 1) % Math.max(1, frames.length)];
  const shown = useMemo(
    () =>
      warnings.data.filter(
        (w) =>
          filter === "all" ||
          (filter === "other"
            ? !categories.some((c) => c.id === w.category)
            : w.category === filter),
      ),
    [warnings.data, filter],
  );
  const serious = warnings.data.filter((w) => w.level >= 3);
  const unknownCategories = warnings.data.some(
    (w) => !categories.some((c) => c.id === w.category),
  );
  const searchResults = useMemo(() => {
    const q = query.normalize("NFKC").trim().toLowerCase();
    if (!q) return [];
    return places
      .filter((p) => (p.prefecture + p.name + p.kana).toLowerCase().includes(q))
      .sort((a, b) => Number(b.name === q) - Number(a.name === q))
      .slice(0, 8);
  }, [places, query]);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (requested && frames.length && !frames.some((f) => f.id === requested)) {
      setRequested(null);
      setPlaying(false);
    }
  }, [frames, requested]);
  useEffect(() => {
    setListLimit(80);
  }, [filter]);
  useEffect(() => {
    fetch("/data/places.json")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setPlaces)
      .catch(() =>
        setMapError(
          "地域データを取得できません。検索と警報区域表示が利用できません。",
        ),
      );
    const timer = setInterval(() => setNow(new Date().toISOString()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!playing || !frameReady || frames.length < 2 || !radarVisible) return;
    const timer = setTimeout(() => {
      setRequested(nextFrame.id);
      setFrameReady(false);
    }, 850);
    return () => clearTimeout(timer);
  }, [playing, frameReady, frame?.id, frames, radarVisible, nextFrame]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  function selectPlace(place: PlaceResult) {
    setAction({ kind: "place", place, nonce: Date.now() });
    setQuery(place.name);
    setSearchOpen(false);
    searchRef.current?.blur();
  }
  function selectWarning(id: string) {
    setSelected(id);
    const w = warnings.data.find((w) => w.id === id),
      p = w && placeMap.get(w.areaCode);
    if (p) setAction({ kind: "place", place: p, nonce: Date.now() });
  }
  function chooseFrame(id: string) {
    setRequested(id);
    setPlaying(false);
    setFrameReady(false);
  }
  function live() {
    setRequested(null);
    setPlaying(false);
  }
  const allHealthy =
    rain.health.state === "LIVE" && warnings.health.state === "LIVE";
  const refresh = () => {
    void rain.refresh();
    void warnings.refresh();
    setMapError("");
  };
  return (
    <main
      className={`app ${theme} ${sheet ? "sheet-open" : ""} ${timelineOpen ? "timeline-open" : ""}`}
    >
      <header className="topbar">
        <a className="brand" href="/" aria-label="AMATERAS ホーム">
          <span className="wordmark">
            AMATERAS
            <span className="solar-arc" />
          </span>
          <span className="brand-sub">LIVE WEATHER MAP / JAPAN</span>
        </a>
        <div className="search-wrap">
          <Search size={16} />
          <input
            ref={searchRef}
            aria-label="地名・市区町村を検索"
            role="combobox"
            aria-expanded={searchOpen && !!searchResults.length}
            aria-controls="place-results"
            aria-activedescendant={
              searchOpen && searchResults[searchIndex]
                ? `place-${searchIndex}`
                : undefined
            }
            placeholder="地名・市区町村を検索"
            value={query}
            onFocus={() => setSearchOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchOpen(true);
              setSearchIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSearchOpen(false);
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSearchIndex((i) =>
                  Math.min(i + 1, searchResults.length - 1),
                );
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSearchIndex((i) => Math.max(0, i - 1));
              }
              if (e.key === "Enter" && searchResults[searchIndex])
                selectPlace(searchResults[searchIndex]);
            }}
          />
          {query ? (
            <button
              aria-label="検索をクリア"
              onClick={() => {
                setQuery("");
                setSearchOpen(false);
              }}
            >
              <X size={13} />
            </button>
          ) : (
            <kbd>⌕</kbd>
          )}
          {searchOpen && query && (
            <div className="search-results" id="place-results" role="listbox">
              {searchResults.map((p, i) => (
                <button
                  key={p.code}
                  id={`place-${i}`}
                  role="option"
                  aria-selected={searchIndex === i}
                  onClick={() => selectPlace(p)}
                >
                  <LocateFixed size={15} />
                  <span>
                    {p.name}
                    <small>{p.prefecture}</small>
                  </span>
                  <ChevronRight size={13} />
                </button>
              ))}
              {!searchResults.length && <p>一致する地域がありません</p>}
            </div>
          )}
        </div>
        <div className="top-status">
          <button
            className={`live-pill ${allHealthy ? "healthy" : "degraded"}`}
            onClick={() => setModal("sources")}
          >
            <span className="status-dot" />
            {fixture ? "MOCK" : allHealthy ? "LIVE" : "データ確認"}
          </button>
          <div className="clock">
            <span>{timeJst(now, true)}</span>
            <small>JST</small>
          </div>
          <button
            className="icon-button settings-trigger"
            aria-label="設定"
            onClick={() => setModal("settings")}
          >
            <Settings2 size={17} />
          </button>
        </div>
      </header>
      <section className="map-stage">
        <WeatherMap
          theme={theme}
          terrain={terrain}
          radar={radarVisible}
          opacity={opacity}
          frame={frame}
          nextFrame={nextFrame}
          warnings={shown}
          places={places}
          selected={selected}
          action={action}
          onSelect={selectWarning}
          onReadyFrame={(f) => {
            setDisplayed(f);
            setFrameReady(true);
          }}
          onError={(s) => {
            setMapError(s);
            setPlaying(false);
          }}
          onTerrainError={() => {
            setTerrain(false);
            setMapError("地形データを取得できないため、2D表示に戻しました。");
          }}
          onCamera={setCamera}
        />
        <div className="map-heading">
          <span className="crosshair" />
          日本全国<small>WEATHER OBSERVATION</small>
        </div>
        <div className="warning-counters" aria-label="種類別の発表区域数">
          {categories.slice(0, 3).map((c) => {
            const count = warnings.data.filter(
              (w) => w.category === c.id,
            ).length;
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                className={`counter ${count ? "nonzero" : ""} ${filter === c.id ? "active" : ""}`}
                onClick={() => setFilter(filter === c.id ? "all" : c.id)}
                title="区域×情報種別の重複を除いた件数"
              >
                <Icon size={17} />
                <b>{warnings.health.fetchedAt ? count : "—"}</b>
                <span>{c.name}</span>
              </button>
            );
          })}
        </div>
        {fixture && (
          <div className="mock-banner">
            MOCK DATA — {scenario} / 画面検証用・実際の警報ではありません
          </div>
        )}
        <div className="map-nav">
          <button
            aria-label="拡大"
            onClick={() => setAction({ kind: "zoomIn", nonce: Date.now() })}
          >
            <Plus size={18} />
          </button>
          <button
            aria-label="縮小"
            onClick={() => setAction({ kind: "zoomOut", nonce: Date.now() })}
          >
            <Minus size={18} />
          </button>
          <button
            aria-label="全国表示に戻す"
            onClick={() => setAction({ kind: "reset", nonce: Date.now() })}
          >
            <Maximize size={16} />
          </button>
        </div>
        {mapError && (
          <div className="map-notice" role="status">
            <Info size={15} />
            <span>{mapError}</span>
            <button aria-label="通知を閉じる" onClick={() => setMapError("")}>
              <X size={14} />
            </button>
          </div>
        )}
        <div className="map-coordinate">{camera}</div>
        <button
          className="mobile-warning-toggle"
          onClick={() => {
            setSheet(!sheet);
            setTimelineOpen(false);
          }}
        >
          <TriangleAlert size={16} />
          発表中の情報{" "}
          <b>{warnings.health.fetchedAt ? warnings.data.length : "—"}</b>
          <ChevronDown size={16} />
        </button>
        <div className="radar-timeline">
          <div className="timeline-header">
            <span>
              <Radio size={12} />
              雨雲の動き
            </span>
            <strong>
              {displayed
                ? timeJst(displayed.timestamp)
                : frames.length
                  ? "画像読込中"
                  : rain.loading
                    ? "読み込み中"
                    : "取得できません"}
              <small>JST</small>
            </strong>
            <button className={!requested ? "is-live" : ""} onClick={live}>
              最新
            </button>
            <button
              className="timeline-close"
              aria-label="タイムラインを閉じる"
              onClick={() => setTimelineOpen(false)}
            >
              <X size={14} />
            </button>
          </div>
          <div className="timeline-transport">
            <button
              aria-label={playing ? "雨雲再生を停止" : "雨雲を再生"}
              disabled={frames.length < 2 || !radarVisible}
              onClick={() => setPlaying(!playing)}
            >
              {playing ? <Pause size={17} /> : <Play size={17} />}
            </button>
            <div className="frame-controls">
              <div className="frame-bars" aria-hidden="true">
                {frames.map((f) => (
                  <i
                    key={f.id}
                    className={
                      f.id === displayed?.id
                        ? "displayed"
                        : f.id === frame?.id
                          ? "pending"
                          : ""
                    }
                  />
                ))}
              </div>
              <input
                aria-label="雨雲の表示時刻"
                type="range"
                min={0}
                max={Math.max(0, frames.length - 1)}
                value={frameIndex}
                disabled={!frames.length}
                onChange={(e) => chooseFrame(frames[+e.target.value].id)}
              />
              <div className="timeline-labels">
                <span>{timeJst(frames[0]?.timestamp ?? null)}</span>
                <span>{requested ? "履歴を表示" : "過去3時間・観測"}</span>
                <span>{timeJst(frames.at(-1)?.timestamp ?? null)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
      <aside
        className="warning-rail"
        aria-label="発表中の気象情報"
        inert={compact && !sheet}
      >
        <header className="rail-header">
          <div>
            <span className="eyebrow">ACTIVE WARNINGS</span>
            <h1>発表中の情報</h1>
          </div>
          <button
            className="rail-close icon-button"
            aria-label="警報一覧を閉じる"
            onClick={() => setSheet(false)}
          >
            <X size={17} />
          </button>
        </header>
        <div className="rail-summary">
          <strong>
            {warnings.health.fetchedAt ? warnings.data.length : "—"}
            <small>件</small>
          </strong>
          <div>
            <span className={serious.length ? "warning-text" : ""}>
              {serious.length ? `警報以上 ${serious.length}件` : "警報・注意報"}
            </span>
            <small>区域・種別ごとに集計</small>
          </div>
        </div>
        <div className="warning-filters" aria-label="警報の絞り込み">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            すべて
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              className={filter === c.id ? "active" : ""}
              onClick={() => setFilter(c.id)}
            >
              {c.name}
            </button>
          ))}
          {unknownCategories && (
            <button
              className={filter === "other" ? "active" : ""}
              onClick={() => setFilter("other")}
            >
              その他
            </button>
          )}
        </div>
        <div className="rail-source">
          <span
            className={`status-dot ${warnings.health.state !== "LIVE" ? "amber" : ""}`}
          />
          {warnings.loading && !warnings.health.fetchedAt
            ? "気象庁データを取得中"
            : warnings.health.state === "LIVE"
              ? `取得 ${timeJst(warnings.health.fetchedAt)} JST`
              : `${warnings.health.state} / 最終取得 ${timeJst(warnings.health.fetchedAt)}`}
          <button
            aria-label="データの状態と出典"
            onClick={() => setModal("sources")}
          >
            <Info size={12} />
          </button>
        </div>
        <div className="warning-list">
          {shown.slice(0, listLimit).map((w) => {
            const p = placeMap.get(w.areaCode),
              Icon =
                categories.find((c) => c.id === w.category)?.icon ??
                TriangleAlert;
            return (
              <button
                className={`warning-row ${selected === w.id ? "selected" : ""}`}
                style={
                  {
                    "--severity":
                      w.level === 5
                        ? "#ead2ff"
                        : (WARNING_COLORS[w.level] ?? "#94a3b8"),
                  } as React.CSSProperties
                }
                key={w.id}
                onClick={() => selectWarning(w.id)}
              >
                <div className="row-icon">
                  <Icon size={16} />
                </div>
                <div className="row-copy">
                  <div className="row-name">
                    {w.name}
                    <ChevronRight size={12} />
                  </div>
                  <span className="row-place">
                    {p?.prefecture} {p?.name ?? `区域 ${w.areaCode}`}
                  </span>
                  <small>{dateJst(w.reportTime)} 発表</small>
                  {selected === w.id && (
                    <div className="row-detail">
                      {w.summary}
                      <span>{w.source}</span>
                      {!p && <span>区域図形の対応未確認</span>}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
          {shown.length > listLimit && (
            <button
              className="load-more"
              onClick={() => setListLimit((n) => n + 80)}
            >
              続きを表示（残り{shown.length - listLimit}件）
            </button>
          )}
          {!warnings.health.fetchedAt ? (
            <div className="empty-state">
              <Radio size={26} />
              <h2>
                {warnings.loading
                  ? "情報を取得しています"
                  : "警報情報を取得できません"}
              </h2>
              <p>
                {warnings.loading
                  ? "気象庁の最新データを確認しています。"
                  : "発表状況は不明です。時間をおいて更新してください。"}
              </p>
            </div>
          ) : !shown.length ? (
            <div className="empty-state">
              <Check size={27} />
              <h2>
                {filter === "all"
                  ? "現在、発表中の情報はありません"
                  : "該当する情報はありません"}
              </h2>
              <p>
                {warnings.health.state === "LIVE"
                  ? "最新の取得データを確認しました。"
                  : "最終取得時点の情報です。現在の状況は確認できていません。"}
              </p>
              <span>空の変化を、地図から。</span>
            </div>
          ) : null}
        </div>
        <div className="rail-legend">
          <div>
            <span>降水強度</span>
            <small>mm/h</small>
            <button aria-label="凡例を開く" onClick={() => setModal("legend")}>
              <Info size={13} />
            </button>
          </div>
          <div className="rain-spectrum" />
          <div className="spectrum-labels">
            <span>0</span>
            <span>1</span>
            <span>5</span>
            <span>10</span>
            <span>20</span>
            <span>30</span>
            <span>50</span>
            <span>80+</span>
          </div>
          <p>注意報の区域は拡大すると表示されます</p>
        </div>
      </aside>
      <nav className="bottom-toolbar" aria-label="地図ツール">
        <button onClick={() => setAction({ kind: "reset", nonce: Date.now() })}>
          <MapIcon size={14} />
          <span>全国</span>
        </button>
        <button
          aria-pressed={terrain}
          onClick={() => setTerrain(!terrain)}
          className={terrain ? "active" : ""}
        >
          <Mountain size={14} />
          <span>{terrain ? "3D" : "2D"}</span>
        </button>
        <button
          aria-pressed={radarVisible}
          onClick={() => {
            setRadarVisible(!radarVisible);
            setPlaying(false);
          }}
          className={radarVisible ? "active" : ""}
        >
          <Radio size={14} />
          <span>雨雲</span>
        </button>
        <button onClick={() => setModal("settings")}>
          <Layers size={14} />
          <span>表示</span>
        </button>
        <button className="desktop-tool" onClick={() => setModal("legend")}>
          <Info size={14} />
          <span>凡例</span>
        </button>
        <button
          className="desktop-tool"
          aria-label={playing ? "停止" : "再生"}
          disabled={frames.length < 2 || !radarVisible}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
          <span>{playing ? "停止" : "再生"}</span>
        </button>
        <button
          className="mobile-tool"
          aria-label="タイムラインを開く"
          onClick={() => {
            setTimelineOpen(!timelineOpen);
            setSheet(false);
          }}
        >
          <Clock3 size={15} />
          <span>時刻</span>
        </button>
        <button
          aria-label="データを更新"
          onClick={refresh}
          disabled={rain.loading || warnings.loading}
        >
          <RefreshCw
            size={14}
            className={rain.loading || warnings.loading ? "spin" : ""}
          />
          <span>更新</span>
        </button>
        <button
          aria-label="テーマを切り替える"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          <span>テーマ</span>
        </button>
        <div className="interaction-hint">
          ドラッグで移動<span>·</span>スクロールで拡大<span>·</span>
          右ドラッグで回転
        </div>
        <button className="source-button" onClick={() => setModal("sources")}>
          出典・データ状態
          <ArrowUpRight size={12} />
        </button>
      </nav>
      <footer className={`ticker ${serious.length ? "has-warning" : ""}`}>
        <span className="ticker-tag">
          <TriangleAlert size={13} />
          防災情報
        </span>
        <div>
          {warnings.health.state !== "LIVE"
            ? `警報情報：${warnings.health.state} — 現在の状況を確認できていません。`
            : fixture
              ? "MOCK DATA / この画面の警報は検証用です。"
              : serious.length
                ? `${serious[0].name}　${placeMap.get(serious[0].areaCode)?.name ?? serious[0].areaCode} ほか ${serious.length}件　／　気象庁発表`
                : warnings.data.length
                  ? "発表中の注意報は、右の一覧または地図から確認できます。"
                  : "現在、発表中の気象警報・注意報はありません。"}
          <span className="ticker-secondary">
            公式情報を確認し、周囲の状況に注意してください。
          </span>
        </div>
        <span className="ticker-end">AMATERAS</span>
      </footer>
      {modal && (
        <Modal
          title={
            modal === "legend"
              ? "地図の凡例"
              : modal === "settings"
                ? "表示設定"
                : "出典とデータの状態"
          }
          onClose={() => setModal(null)}
        >
          {modal === "settings" ? (
            <>
              <p className="modal-intro">地図の見やすさを調整します。</p>
              <label className="setting-row">
                雨雲を表示
                <input
                  type="checkbox"
                  checked={radarVisible}
                  onChange={(e) => setRadarVisible(e.target.checked)}
                />
              </label>
              <label className="setting-row">
                雨雲の濃さ{" "}
                <input
                  aria-label="雨雲の濃さ"
                  type="range"
                  min="0.2"
                  max="1"
                  step="0.05"
                  value={opacity}
                  onChange={(e) => setOpacity(+e.target.value)}
                />
              </label>
              <label className="setting-row">
                3D地形
                <input
                  type="checkbox"
                  checked={terrain}
                  onChange={(e) => setTerrain(e.target.checked)}
                />
              </label>
              <label className="setting-row">
                明るい地図
                <input
                  type="checkbox"
                  checked={theme === "light"}
                  onChange={(e) =>
                    setTheme(e.target.checked ? "light" : "dark")
                  }
                />
              </label>
              <p className="fine-print">
                3Dは実際の標高を1.25倍に強調しています。気象データの意味は変わりません。
              </p>
            </>
          ) : modal === "legend" ? (
            <>
              <p className="modal-intro">
                色と名称をあわせて情報を確認してください。
              </p>
              <h3>雨雲 / 降水強度（mm/h）</h3>
              <div className="rain-spectrum" />
              <div className="spectrum-labels">
                <span>0</span>
                <span>1</span>
                <span>5</span>
                <span>10</span>
                <span>20</span>
                <span>30</span>
                <span>50</span>
                <span>80+</span>
              </div>
              <h3>気象警報・注意報</h3>
              {[
                [2, "注意報"],
                [3, "警報"],
                [4, "危険警報"],
                [5, "特別警報"],
              ].map(([n, t]) => (
                <div className="legend-row" key={n}>
                  <i style={{ background: WARNING_COLORS[Number(n)] }} />
                  <span>{t}</span>
                </div>
              ))}
              <p className="fine-print">
                大雨・土砂災害・高潮は公式のレベルを名称に表示します。その他の情報に独自の警戒レベルは付けません。地図の色は発表区域を表し、区域内すべての地点が同じ危険度とは限りません。
              </p>
            </>
          ) : (
            <>
              <p className="modal-intro">
                AMATERASは公開情報を地図上に表示します。独自の予報や警報は発表しません。
              </p>
              {[rain.health, warnings.health].map((h) => (
                <div className="source-health" key={h.id}>
                  <div>
                    <b>{h.label}</b>
                    <span>{h.state}</span>
                  </div>
                  <p>
                    発表・観測 {dateJst(h.sourceTime)}
                    <br />
                    取得 {dateJst(h.fetchedAt)}
                    {h.error && (
                      <>
                        <br />
                        {h.error}
                      </>
                    )}
                  </p>
                </div>
              ))}
              <ul className="sources-list">
                <li>
                  <a
                    href="https://www.jma.go.jp/bosai/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    気象庁 <ArrowUpRight size={12} />
                  </a>
                  <small>雨雲・気象警報・地域データ。表示用に加工。</small>
                </li>
                <li>
                  <a
                    href="https://maps.gsi.go.jp/development/ichiran.html"
                    target="_blank"
                    rel="noreferrer"
                  >
                    国土地理院 <ArrowUpRight size={12} />
                  </a>
                  <small>標高タイルを変換して地形を表示。</small>
                </li>
                <li>
                  <a
                    href="https://openfreemap.org/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    OpenFreeMap / OpenMapTiles / OpenStreetMap
                  </a>
                  <small>背景地図。AMATERAS用にスタイルを調整。</small>
                </li>
              </ul>
              <p className="fine-print">
                雨雲は過去約3時間の観測です。空白の場所は降水なしと観測範囲外を区別できない場合があります。通信障害時は最終取得データを保持します。地域別の河川氾濫情報など、未対応の情報があります。
              </p>
            </>
          )}
        </Modal>
      )}
    </main>
  );
}
export default App;
