# エージェント用コンテキスト & ガイドライン

## 🚀 プロジェクト概要
**Browser Game Engine** は、ECS (Entity Component System) アーキテクチャを採用した、WebGPUベースのカスタム2Dゲームエンジンです。
- **モノレポ構成**: npm workspaces で管理されています。
  - `packages/engine`: ゲームエンジンのコア機能。
  - `packages/framework`: ゲームエンジンのデータ駆動フレームワーク。
  - `apps/private-game`: エンジンを使用した非公開のゲーム。
  - `@my-engine/core`は、`/webgpu`や`/input`といったサブパスでのエクスポートをサポートしているため、インポートパスに注意すること。

## 🛠️ アーキテクチャ
- **ECS**: Entity, Component, System を厳密に分離しています。
  - **Entity**: `active` 状態を持ちます。`World.setActive` で制御し、無効なエンティティはクエリから除外されます。
  - **Transform**: 親子関係 (`parent`, `children`) と `z` 座標による表示順序制御をサポートします。
- **レンダラー**: `WebGPURenderSystem` が **Dynamic Batching** を使用して描画します。CPU側で頂点を生成し、テクスチャ切り替えを最小化して一括描画します。
- **リソース管理**: `ResourceManager` でテクスチャ、音声、フォントを一元管理します。
- **データ駆動**: `SceneLoader` により、JSON データからシーン（アセット、エンティティ）を構築可能です。

## 📌 重要な開発パターン
### 1.設計思想
- ツリーシェイキングを効かせ、必要な機能だけをロードする設計を目指しています。
- まとまったプロパティは内部では配列で管理し、setterで配列や個別プロパティで設定できるようにします。
- **Componentはデータのみ**: ロジックはSystemに記述します。

### 2. リソース管理 (マニフェストパターン)
アセット管理には **Type-Safe Key (型安全なキー)** パターンを使用します。
- `GameScene` でキー定義 (`IMAGE_KEYS`, `AUDIO_KEYS`) とマニフェスト定義を行います。
- `resourceManager.loadTextureManifest` / `loadAudioManifest` でロードします。
- **フォント**: `resourceManager.fonts.load(family, url)` を使用して `.ttf` や `.otf` をロードします。ロードされたフォントは `Text` コンポーネントの `fontFamily` で指定可能です。
- ゲームロジック内で **マジックストリングや生のファイルパスを使用しないことを推奨** します。

### 3. ビルド環境 & 開発環境
- **Vite エイリアス**: `apps/private-game` では、`@my-engine/core` が `packages/engine/src` を直接参照するように設定されています。
  - これにより、エンジン側のコードを編集しても **ビルド不要** でゲーム側に即座に反映されます。
  - **例外**: `package.json` の `exports` を変更した場合などは、開発サーバーの再起動が必要になることがあります。
- **WGSL**: `.wgsl` ファイルは、カスタムViteプラグイン (`wgslLoader`) によって生の文字列として読み込まれます。
- **ファイル出力**: `tsconfig.json` の設定により、`src` ディレクトリ内に `.js` ファイルが出力されないようになっています。`dist` を生成するには `npm run build` を使用してください。

## 📂 ディレクトリ構造
- `apps/private-game/public/assets/`: 実行時に必要なアセット（画像/音声）はここに配置します。
- `packages/engine/src/shaders/`: WGSL シェーダーファイルはここにあります。
- `packages/engine/src/framework/`: `SceneLoader` などの高レベル機能が含まれます。

## ⚠️ よくある落とし穴
- **404 エラー**: アセットのパスに注意してください。`public` ディレクトリからの相対パス (`/assets/pen1.png` など) である必要があります。
- **テクスチャ表示**: 画像が表示されない場合、`z` インデックス (Transform) が正しいか、または `Renderable/Sprite` コンポーネントが正しくアタッチされているか確認してください。
