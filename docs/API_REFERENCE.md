# API リファレンス

Browser Game Engine は TypeScript で記述されており、詳細な API ドキュメントはソースコード内の TSDoc コメントとして提供されています。IDE (VSCode 等) でクラスやメソッドにホバーすることで、最新のドキュメントを参照できます。

以下は、エンジンの主要なクラスとインターフェースの概要です。

## ECS (Entity Component System)

### [World](./packages/engine/src/ecs/World.ts)
ゲームの全てのエンティティ、コンポーネント、システムを管理する中心的なクラスです。
- `createEntity()`: 新しいエンティティを作成します。
- `addComponent(entity, component)`: エンティティにコンポーネントを追加します。
- `query(componentType)`: 特定のコンポーネントを持つエンティティのリストを取得します。

### [Entity](./packages/engine/src/ecs/Entity.ts)
エンティティは単なる ID (`number`) です。

### [Component](./packages/engine/src/ecs/Component.ts)
データのコンテナです。ロジックは持ちません。全てのカスタムコンポーネントはこのクラスを継承する必要があります。

### [System](./packages/engine/src/ecs/System.ts)
ロジックの実装場所です。`update(dt)` メソッドを実装し、フレームごとの処理を行います。

## Core

### [Scene](./packages/engine/src/core/Scene.ts)
ゲームの状態（タイトル、ゲームプレイなど）を表します。`onEnter` と `onExit` で初期化と終了処理を行います。

### [SceneManager](./packages/engine/src/core/SceneManager.ts)
シーンの遷移を管理します。`switchScene` でシーンを切り替えます。

### [ResourceManager](./packages/engine/src/core/ResourceManager.ts)
画像や音声などのアセットロードを管理します。

## WebGPU Renderer

### [WebGPURenderer](./packages/engine/src/renderer/WebGPURenderer.ts)
WebGPU の初期化と描画ループの基盤を提供します。

### [Sprite](./packages/engine/src/webgpu/components/Sprite.ts)
画像を描画するためのコンポーネントです。

### [Transform](./packages/engine/src/components/Transform.ts)
位置、回転、スケールを持つコンポーネントです。描画されるエンティティには必須です。
