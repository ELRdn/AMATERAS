import {
  dateJst,
  type EarthquakeEvent,
  type TyphoonEvent,
  type SourceHealth,
} from "../data/types";
interface Props {
  kind: "earthquakes" | "typhoons";
  earthquakes: EarthquakeEvent[];
  typhoons: TyphoonEvent[];
  health: SourceHealth;
  loading: boolean;
  selected: string | null;
  onSelect: (id: string) => void;
}
export function EventList(p: Props) {
  const quake = p.kind === "earthquakes";
  const data = quake ? p.earthquakes : p.typhoons;
  return (
    <>
      <div className="event-summary">
        <strong>{p.health.fetchedAt ? data.length : "—"}</strong>
        <span>
          {quake ? "直近24時間の地震" : "現在の台風情報"}
          <small>{quake ? "発生時刻を基準に表示" : "気象庁の実況・予報"}</small>
        </span>
      </div>
      <div className="rail-source">
        <span
          className={"status-dot " + (p.health.state === "LIVE" ? "" : "amber")}
        />
        {p.loading && !p.health.fetchedAt
          ? "情報を取得中"
          : p.health.state + " / 取得 " + dateJst(p.health.fetchedAt)}
      </div>
      {p.health.error && (
        <p className="event-source-error" role="status">
          {p.health.error}
        </p>
      )}
      <div className="warning-list event-list">
        {!p.health.fetchedAt ? (
          <div className="empty-state">
            <h2>
              {p.loading ? "情報を取得しています" : "情報を取得できません"}
            </h2>
            <p>現在の状況は確認できていません。</p>
          </div>
        ) : !data.length ? (
          <div className="empty-state">
            <h2>
              {p.health.state === "LIVE"
                ? quake
                  ? "直近24時間の地震情報はありません"
                  : "現在の台風情報はありません"
                : "現在の状況は確認できていません"}
            </h2>
            <p>
              {p.health.state === "LIVE"
                ? "最新の取得データを確認しました。"
                : "最終取得時点では該当する情報がありませんでした。"}
            </p>
          </div>
        ) : null}
        {quake
          ? p.earthquakes.map((e) => (
              <article
                className={
                  "event-card " + (p.selected === e.id ? "selected" : "")
                }
                key={e.id}
              >
                <button
                  className="event-select"
                  onClick={() => p.onSelect(e.id)}
                  aria-expanded={p.selected === e.id}
                >
                  <span className="event-value">
                    震度 <b>{e.maxIntensity ?? "—"}</b>
                  </span>
                  <span>
                    <strong>{e.title}</strong>
                    <small>
                      {dateJst(e.occurredAt)} 発生 / M{e.magnitude ?? "不明"}
                    </small>
                  </span>
                </button>
                {p.selected === e.id && (
                  <div className="event-detail">
                    <p>
                      震源の深さ{" "}
                      {e.depthKm === null ? "不明" : e.depthKm + " km"}
                      {!e.position && " / 位置情報なし：一覧のみ"}
                    </p>
                    <p>
                      円の動きは発生情報の強調です。地震波の到達範囲を表しません。
                    </p>
                    <Source source={e.source} />
                  </div>
                )}
              </article>
            ))
          : p.typhoons.map((e) => (
              <article
                className={
                  "event-card typhoon-card " +
                  (p.selected === e.id ? "selected" : "")
                }
                key={e.id}
              >
                <button
                  className="event-select"
                  onClick={() => p.onSelect(e.id)}
                  aria-expanded={p.selected === e.id}
                >
                  <span className="event-value">
                    <b>{Number(e.number.slice(-2)) || "—"}</b> 号
                  </span>
                  <span>
                    <strong>{e.name || "台風情報"}</strong>
                    <small>
                      {e.category} / {dateJst(e.current?.time ?? null)} 実況
                    </small>
                  </span>
                </button>
                {e.detailState !== "LIVE" && (
                  <p className="event-source-error">
                    {e.detailError ?? "詳細の更新を確認中"}
                  </p>
                )}
                {p.selected === e.id && (
                  <div className="event-detail">
                    <p>
                      中心気圧 {e.current?.pressure ?? "不明"} hPa / 最大風速{" "}
                      {e.current?.wind ?? "不明"} m/s
                    </p>
                    <p>
                      実線：取得済みの実況経路 /
                      破線：予報中心・予報円。予報円は台風の大きさを表しません。
                    </p>
                    <p>
                      実況経路の取得範囲：{dateJst(e.track[0]?.time ?? null)}〜
                      {dateJst(e.track.at(-1)?.time ?? null)}
                    </p>
                    <ul className="forecast-list">
                      {e.forecast.map((f) => (
                        <li key={f.time}>
                          <time>{dateJst(f.time)}</time>
                          <span>
                            予報円{" "}
                            {f.forecastRadiusKm === null
                              ? "不明"
                              : f.forecastRadiusKm + " km"}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {!e.current && (
                      <p>
                        位置情報を取得できないため、地図には描画していません。
                      </p>
                    )}
                    <Source source={e.source} />
                  </div>
                )}
              </article>
            ))}
      </div>
    </>
  );
}
function Source({ source }: { source: EarthquakeEvent["source"] }) {
  return (
    <p className="event-source">
      発表 {dateJst(source.issuedAt)} / 取得 {dateJst(source.fetchedAt)}
      <br />
      <a href={source.url} target="_blank" rel="noreferrer">
        {source.organization}の原文を開く ↗
      </a>
    </p>
  );
}
