import { Gauge, Leaf, Sparkles } from "lucide-react";
import type { FxQuality, EffectiveQuality } from "../data/types";
import {
  GRAPHICS_PRESETS,
  graphicsPreset,
  type GraphicsSettings as Settings,
  type RenderStats,
} from "../map/graphics";
const presets = [
  {
    id: "performance",
    name: "省電力",
    description: "iGPU・軽さ優先",
    icon: Leaf,
  },
  { id: "balanced", name: "バランス", description: "普段使いに", icon: Gauge },
  {
    id: "quality",
    name: "高画質",
    description: "細部・立体を優先",
    icon: Sparkles,
  },
] as const;
export function GraphicsSettings({
  settings,
  onChange,
  stats,
  effective,
  osReducedMotion,
}: {
  settings: Settings;
  onChange: (value: Settings) => void;
  stats: RenderStats | null;
  effective: EffectiveQuality;
  osReducedMotion: boolean;
}) {
  const selected = graphicsPreset(settings);
  const change = (value: Partial<Settings>) =>
    onChange({ ...settings, ...value });
  return (
    <section className="graphics-settings" aria-labelledby="graphics-title">
      <div className="graphics-heading">
        <div>
          <span>GRAPHICS</span>
          <h3 id="graphics-title">描画品質</h3>
        </div>
        <span className="graphics-current">
          {selected === "custom"
            ? "カスタム"
            : presets.find((p) => p.id === selected)!.name}
        </span>
      </div>
      <div
        className="graphics-presets"
        role="group"
        aria-label="グラフィックプリセット"
      >
        {presets.map(({ id, name, description, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-label={name + "プリセット"}
            aria-pressed={selected === id}
            onClick={() => onChange({ ...GRAPHICS_PRESETS[id] })}
          >
            <Icon size={18} />
            <strong>{name}</strong>
            <small>{description}</small>
          </button>
        ))}
      </div>
      <div className="graphics-readout" role="status">
        <span>
          地図の描画解像度{" "}
          <b>{stats ? stats.width + " × " + stats.height : "準備中"}</b>
        </span>
        <small>
          100%設定に対する画素数：約
          {Math.round(settings.renderScale ** 2 * 100)}%
        </small>
      </div>
      <p className="graphics-help">
        重いときは「省電力」。設定はすぐに反映され、この端末に保存されます。
      </p>
      <label className="setting-row">
        <span>
          描画解像度
          <small>下げると軽くなり、地図の文字や輪郭が粗くなります。</small>
        </span>
        <select
          aria-label="描画解像度"
          value={settings.renderScale}
          onChange={(e) =>
            change({ renderScale: +e.target.value as Settings["renderScale"] })
          }
        >
          <option value={0.5}>50% / 軽量</option>
          <option value={0.75}>75% / 標準</option>
          <option value={1}>100% / 鮮明</option>
        </select>
      </label>
      <label className="setting-row">
        <span>
          地形の細かさ
          <small>広域向けにすると、拡大時の山の起伏が粗くなります。</small>
        </span>
        <select
          aria-label="地形の細かさ"
          value={settings.terrainDetail}
          onChange={(e) =>
            change({
              terrainDetail: e.target.value as Settings["terrainDetail"],
            })
          }
        >
          <option value="low">広域向け / 軽量</option>
          <option value="medium">標準</option>
          <option value="high">高精細</option>
        </select>
      </label>
      <label className="setting-row">
        <span>
          地形の陰影<small>山肌の明暗を強調します。</small>
        </span>
        <input
          type="checkbox"
          aria-label="地形の陰影"
          checked={settings.hillshade}
          onChange={(e) => change({ hillshade: e.target.checked })}
        />
      </label>
      <label className="setting-row">
        <span>
          道路・建物の詳細
          <small>細い道路や建物の表示を切り替えます。</small>
        </span>
        <input
          type="checkbox"
          aria-label="道路・建物の詳細"
          checked={settings.mapDetails}
          onChange={(e) => change({ mapDetails: e.target.checked })}
        />
      </label>
      <label className="setting-row">
        <span>
          立体表現の品質
          <small>
            Lowは区域面・輪郭・静止マーカー。Autoは負荷に応じて低下。
          </small>
        </span>
        <select
          aria-label="立体表現の品質"
          value={settings.fxQuality}
          onChange={(e) => change({ fxQuality: e.target.value as FxQuality })}
        >
          <option value="auto">Auto（自動）</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </label>
      <label className="setting-row">
        <span>
          アニメーション
          <small>地震パルスと滑らかなカメラ移動。Lowのパルスは静止。</small>
        </span>
        <input
          type="checkbox"
          aria-label="アニメーション"
          checked={settings.animations && !osReducedMotion}
          disabled={osReducedMotion}
          onChange={(e) => change({ animations: e.target.checked })}
        />
      </label>
      <p className="graphics-help">
        現在の立体品質：
        {(settings.fxQuality === "auto"
          ? effective
          : settings.fxQuality
        ).toUpperCase()}
        。
        {osReducedMotion
          ? "動きを減らす設定：有効（演出は静止表示）"
          : !settings.animations
            ? "アニメーションを停止中。"
            : "地震のパルスは選択時のみ表示します。"}
      </p>
    </section>
  );
}
