# luma.gl 9.4.0 lifecycle patch

AMATERASのFXをテーマ／2D／3Dで繰り返し生成・破棄すると、終了済みのAnimationLoopからFxManagerと警報メッシュが保持されることを、Chromiumのヒープスナップショットで確認しました。

`@luma.gl__engine@9.4.0.patch` は、使用バージョンを変えずに次を修正します。

- AnimationLoopはコンストラクターで束縛した同じmousemove／mouseleave関数を登録・解除する。二重bindとdestroy時の解除漏れを修正。
- Modelの終了時、およびbuffer layoutによる頂点配列の置換前に、所有するvertexArrayを破棄する。

配布用distと対応するsrcを同じ内容に修正しています。package.jsonのpnpm.patchedDependenciesとpnpm-lock.yamlにハッシュを記録し、通常の `pnpm install --frozen-lockfile` で適用します。グローバルなライブラリやユーザーの設定は変更しません。

検証：`tests/e2e/fx.spec.ts` の20回切替でcanvasイベント数が一定であることを確認。`node scripts/measure-fx.mjs` は実背景／DEMでJSヒープ・WebGLオブジェクト・タイマーを観測します。今回の修正前後の実測はIMPLEMENTATION_REPORT.mdを参照。

元ライブラリはvis.gl contributorsのMITライセンスです。更新時は上流の終了処理を確認し、修正が含まれた版ではこのパッチを外した状態で同じ試験を実行してください。自動で無視するパッチ設定は使用しません。
