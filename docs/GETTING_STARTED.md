# はじめに (Getting Started)

このガイドでは、Browser Game Engine を使用してシンプルなゲームを作成する方法を説明します。

## 前提条件

- **Node.js**: バージョン 18 以上推奨
- **WebGPU 対応ブラウザ**: Google Chrome 113 以降、または WebGPU が有効化された Edge/Firefox。

## インストール

パッケージマネージャを使用してエンジンをインストールします（現在は Monorepo 内での利用を想定しています）。

```bash
npm install
```

## プロジェクトのセットアップ

Vite と TypeScript を使用したプロジェクト構成を推奨します。以下は `main.ts` での初期化コードの例です。

```typescript
import { Game, SceneManager, ResourceManager, ComponentRegistry, Transform, Camera } from '@my-engine/core';
import { WebGPURenderer, Sprite, Renderable } from '@my-engine/core/webgpu';
import { InputManager } from '@my-engine/core/input';
import { AudioManager } from '@my-engine/core/audio';

async function main() {
    // 1. レンダラーの初期化
    const canvas = document.getElementById('game') as HTMLCanvasElement;
    const renderer = new WebGPURenderer({
        canvas,
        virtualWidth: 800,
        virtualHeight: 600
    });
    await renderer.init();

    // 2. ゲームループとマネージャーの初期化
    const game = new Game();
    const input = new InputManager();
    const audio = new AudioManager();
    const resourceManager = new ResourceManager(renderer, audio);
    const sceneManager = new SceneManager(game.world, resourceManager);

    // 3. コンポーネントの登録 (JSONロード用)
    const registry = ComponentRegistry.getInstance();
    registry.register('Transform', Transform);
    registry.register('Sprite', Sprite);

    // 4. シーンの開始
    await sceneManager.switchScene(new MyFirstScene(sceneManager, input, renderer, resourceManager));
    game.start();
}

main();
```

## シーンの作成

`Scene` クラスを継承して、独自のシーンを作成します。エンジンは **JSON ベースの `SceneLoader`** もサポートしていますが、ここでは基本的なコードによる定義方法を解説します。

```typescript
import { Scene, World, Entity } from '@my-engine/core';
import { Transform } from '@my-engine/core/components/Transform';
import { Sprite } from '@my-engine/core/webgpu/components/Sprite';

export class MyFirstScene extends Scene {
    public override async onEnter(world: World): Promise<void> {
        // 画像のロード（マニフェストの使用を推奨）
        await this.resourceManager.loadTexture('player', '/assets/player.png');

        // エンティティの作成
        const player = world.createEntity();
        
        // コンポーネントの追加
        // Transform(x, y, z) - z は描画順序 (大きいほど手前)
        world.addComponent(player, new Transform(400, 300, 10)); 
        world.addComponent(player, new Sprite('player'));
    }

    public override onExit(world: World): void {
        // 必要に応じてクリーンアップ
    }
}
```

## システムの追加

独自のロジックを追加するには `System` を作成します。

```typescript
import { System, World, Transform } from '@my-engine/core';

export class PlayerControlSystem extends System {
    public update(dt: number): void {
        // ここにロジックを記述
        // 例: 入力に応じて Transform を更新
    }
}

// Scene.onEnter 内で登録
world.addSystem(new PlayerControlSystem());
```

## ゲームの実行

Vite 開発サーバーを起動してゲームを確認します。

```bash
npm run dev
```
