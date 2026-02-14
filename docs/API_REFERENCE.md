# API リファレンス

Browser Game Engine は TypeScript で記述されており、詳細な API ドキュメントはソースコード内の TSDoc コメントとして提供されています。IDE (VSCode 等) でクラスやメソッドにホバーすることで、最新のドキュメントを参照できます。

以下は、エンジンの主要なクラスとインターフェースの概要です。

## ECS (Entity Component System)

### [World](./packages/engine/src/ecs/World.ts)
ゲームの全てのエンティティ、コンポーネント、システムを管理する中心的なクラスです。
- `createEntity()`: 新しいエンティティを作成します。
- `addComponent(entity, component)`: エンティティにコンポーネントを追加します。
- `query(componentType)`: 特定のコンポーネントを持つ**有効な**エンティティのリストを取得します。
- `setActive(entity, boolean)`: エンティティの有効/無効を切り替えます。無効なエンティティは `query` の結果に含まれません。
- `isActive(entity)`: エンティティが有効かどうかを確認します。

### [Entity](./packages/engine/src/ecs/Entity.ts)
エンティティは単なる ID (`number`) です。

### [Component](./packages/engine/src/ecs/Component.ts)
データのコンテナです。ロジックは持ちません。全てのカスタムコンポーネントはこのクラスを継承する必要があります。

### [System](./packages/engine/src/ecs/System.ts)
ロジックの実装場所です。`update(dt)` メソッドを実装し、フレームごとの処理を行います。
- `init(world)`: システム初期化時に呼ばれます。

### [ScriptSystem](./packages/engine/src/systems/ScriptSystem.ts)
`Script` コンポーネントを持つエンティティに対して、個別のロジック（スクリプト）を実行するシステムです。
- `onStart()`: スクリプト生成時に一度だけ呼ばれます。
- `onUpdate(dt)`: 毎フレーム呼ばれます。
- `onCollisionEnter(otherEntity)`: 物理衝突時に呼ばれます。

## Core & Framework

### [Scene](./packages/engine/src/core/Scene.ts)
ゲームの状態（タイトル、ゲームプレイなど）を表します。`onEnter` と `onExit` で初期化と終了処理を行います。

### [SceneManager](./packages/engine/src/core/SceneManager.ts)
シーンの遷移を管理します。`switchScene` でシーンを切り替えます。

### [SceneLoader](./packages/engine/src/framework/SceneLoader.ts)
JSON データからシーンを構築するヘルパークラスです。
- `loadScene(data)`: `SceneData` 型の JSON オブジェクトを受け取り、アセットのロードとエンティティの生成を行います。

### [ResourceManager](./packages/engine/src/core/ResourceManager.ts)
アセットロードのファサードです。
- `textures`: [TextureStore](./packages/engine/src/core/stores/TextureStore.ts) - 画像のロードと caching。
- `fonts`: [FontStore](./packages/engine/src/core/stores/FontStore.ts) - Webフォント(.ttf, .otf, .woff)およびBitmapフォント(.fnt)のロード。
  - `load(family, url)`: Webフォントをロードし、ブラウザの `FontFace` として登録します。
  - `loadBitmapFont(family, fntUrl, textureUrl)`: Bitmapフォントをロードします。
- `audio`: [AudioManager](./packages/engine/src/core/AudioManager.ts) - 音声のロードと再生。

## Components

### [Transform](./packages/engine/src/components/Transform.ts)
位置、回転、スケール、階層構造を持つコンポーネントです。
- `x`, `y`, `z`: 位置座標。`z` は描画順序（Z-Sort）に影響します。
- `rotation`: 回転（ラジアン）。
- `scale`: スケール。
- `addChild(transform)`, `removeChild(transform)`: 親子関係を構築します。
- `parent`, `children`: 階層構造へのアクセス。

### [Sprite](./packages/engine/src/webgpu/components/Sprite.ts)
画像を描画するためのコンポーネントです。

### [Text](./packages/engine/src/components/Text.ts)
テキストを描画するためのコンポーネントです。
- `content`: 表示する文字列。
- `fontFamily`: フォントファミリー名。`ResourceManager.fonts.load()` でロードした Webフォント、または `loadBitmapFont()` でロードした Bitmapフォントを指定します。
- `fontSize`: フォントサイズ（px）。
- `style`: 色、整列、行間、影、アウトラインなどのスタイル設定。
- **レンダリング**: 指定された `fontFamily` がロード済みの Webフォントであれば Glyph Atlas 方式で描画され、Bitmapフォントであれば Bitmap 方式、それ以外は Canvas フォールバックが使用されます。
