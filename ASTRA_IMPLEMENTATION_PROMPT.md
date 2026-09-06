# AMATERAS — 引き継ぎ指示

このリポジトリは仕様資料のみの段階から、実データを使うローカル実用版へ移行しています。README.md → PROJECT_SPEC.md → TECH_ARCHITECTURE.md → DATA_SOURCES.md → IMPLEMENTATION_REPORT.mdの順に確認してください。

既存のReact/TypeScript/Vite/MapLibre実装とpnpm-lock.yamlを基盤にします。Palette A、Palette Cのロゴ方向、参考動画の全面地図を維持します。Next.jsやThree.jsへの再構築は今回の方針ではありません。

警報は2026年体系のr8/map.jsonを使用し、旧エンドポイントへ戻さないこと。HTTP成功だけで鮮度を判断せず、発表時刻と取得時刻を分離してください。模擬情報を実データ障害時の代替にしないこと。区域コードが不一致なら推測した区域を描かないこと。

変更後はpnpm test / check / buildと必要なPlaywright検証を実施し、ライブ接続結果を固定シナリオのテストとは分けて記録します。公開・コミット・プッシュは別途指示のあるときに行います。
