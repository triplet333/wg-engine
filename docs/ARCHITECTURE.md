# アーキテクチャ概要

Browser Game Engine は、**ECS (Entity Component System)** アーキテクチャと **WebGPU** レンダリングを核とした、TypeScript製の2Dゲームエンジンです。

## コアコンセプト

### 1. ECS (Entity Component System)
ゲームのロジックとデータは ECS パターンに基づいて管理されます。
- **Entity**: 一意のIDを持つ空のコンテナ（実体）。
  - **Active State**: エンティティは有効・無効の状態を持ちます。無効化されたエンティティは `World.query` から除外され、システムによる更新や描画の対象外となります。
- **Component**: データのみを持つクラス（例: `Transform`, `Sprite`, `Physics`）。ロジックは持ちません。
- **System**: ロジックのみを持つクラス（例: `PhysicsSystem`, `RenderSystem`）。特定のコンポーネントを持つエンティティに対して処理を行います。
- **World**: エンティティ、コンポーネント、システムを管理するコンテナ。

### 2. レンダリングパイプライン (WebGPU)
レンダリングは WebGPU を使用し、**Dynamic Batching（動的バッチング）** によって高速な描画を実現しています。

- **WebGPURenderer**: WebGPU デバイスとコンテキストの管理、Canvas のリサイズなどを担当します。
- **WebGPURenderSystem**:
  - **Dynamic Batching**: 毎フレーム、描画対象（Sprite, Text, Renderable）を収集し、テクスチャと Z-index に基づいてソートします。
  - **Z-Sort**: `Transform.z` プロパティに基づいて描画順序を制御します（数値が小さい順に奥、大きい順に手前）。
  - **Quad Generation**: CPU 側でワールド座標変換を行い、頂点バッファを動的に構築して一度に描画コマンドを発行します。これによりドローコールを最小限に抑えます。
  - **Support**:
    - **Sprite**: 画像の描画。
    - **Text**:
      - **Glyph Atlas (OpenType/TrueType)**: `opentype.js` を使用してフォントファイルからグリフパスを取得し、CPU でラスタライズして `GlyphAtlas` (GPUTexture) に書き込みます。各文字はメッシュとして生成され、バッチレンダリングされます。これにより、高品質なテキスト描画と動的なテキスト変更が可能です。
      - **BitmapFont**: 従来のビットマップフォント描画。
      - **Canvas Fallback**: `CanvasRenderingContext2D` で描画したテキストをテクスチャとして転送する方式（レガシー）。
    - **Renderable**: 単色矩形の描画。

### 3. トランスフォーム階層 (Transform Hierarchy)
`Transform` コンポーネントは階層構造（親子関係）をサポートしています。
- 親の `Transform` が移動・回転・スケーリングすると、子にも影響します。
- ワールド座標はシステムによって自動的に計算され、キャッシュされます。

### 4. フレームワーク & データ駆動
エンジンコアの上に、ゲーム開発を効率化するためのフレームワーク層があります。
- **SceneLoader**: JSON 形式のシーン定義ファイルを読み込み、アセットのロードとエンティティの生成を自動化します。これにより、コードを書かずにレベルデザインが可能になります。
- **Stores**: `TextureStore`（画像）、`FontStore`（フォント）などがリソースのロードとキャッシュを一元管理します。

## ディレクトリ構造

このプロジェクトは Monorepo 構成 (npm workspaces) を採用しています。

- `packages/engine` (`@my-engine/core`)
  - `src/ecs/`: ECS の基盤。
  - `src/renderer/`: WebGPU レンダリングシステム。
  - `src/core/`: リソース管理、ストア。
  - `src/framework/`: `SceneLoader` などの高レベル機能。
  - `src/components/`: 標準コンポーネント。

- `apps/private-game`
  - エンジンを使用したゲームの実装例。
