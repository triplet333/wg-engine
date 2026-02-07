# アーキテクチャ概要

Browser Game Engine は、**ECS (Entity Component System)** アーキテクチャと **WebGPU** レンダリングを核とした、TypeScript製の2Dゲームエンジンです。

## コアコンセプト

### 1. ECS (Entity Component System)
ゲームのロジックとデータは ECS パターンに基づいて管理されます。
- **Entity**: 一意のIDを持つ空のコンテナ（実体）。
- **Component**: データのみを持つクラス（例: `Transform`, `Sprite`, `Physics`）。ロジックは持ちません。
- **System**: ロジックのみを持つクラス（例: `PhysicsSystem`, `RenderSystem`）。特定のコンポーネントを持つエンティティに対して処理を行います。
- **World**: エンティティ、コンポーネント、システムを管理するコンテナ。

### 2. レンダリングパイプライン (WebGPU)
レンダリングは WebGPU を使用し、高速なバッチレンダリングを実現しています。
- **WebGPURenderer**: WebGPU デバイスとコンテキストの管理、Canvas のリサイズなどを担当します。
- **WebGPURenderSystem**: ECS の System として動作し、`Renderable` や `Sprite` コンポーネントを持つエンティティを描画します。
  - **Instancing**: 同じテクスチャを使用するスプライトをインスタンシングで一度に描画し、ドローコールを削減します。
  - **Camera**: 複数のカメラをサポートし、カメラごとにビューポートやレイヤー設定を行えます。

### 3. ゲームループ
`Game` クラスがメインループを管理します。`requestAnimationFrame` を使用してループを回し、各フレームで `World.update(dt)` を呼び出します。これにより、登録された全ての System が優先順位順に実行されます。

### 4. シーン管理
`SceneManager` がシーンの遷移を管理します。
- **Scene**: 特定のゲーム状態（タイトル画面、ゲームプレイなど）を表すクラス。
- **遷移**: `switchScene` を呼び出すと、現在のシーンの終了処理 (`onExit`)、World のクリア、新しいシーンの開始処理 (`onEnter`) が順に行われます。

## ディレクトリ構造

このプロジェクトは Monorepo 構成 (npm workspaces) を採用しています。

- `packages/engine/` (`@my-engine/core`)
  - エンジンのコアライブラリ。
  - `src/ecs/`: ECS の基盤。
  - `src/renderer/`: WebGPU レンダリング。
  - `src/core/`: リソース管理、シーン管理など。
  - `src/components/`: 標準コンポーネント。

- `apps/private-game/`
  - エンジンを使用したゲームの実装例。
