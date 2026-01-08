# Browser Game Engine (Monorepo)

[English](README.md) | [日本語](README.jp.md)

このプロジェクトは、シンプルな2Dゲームループに触発されたTypeScriptベースのブラウザゲームエンジンです。npm workspacesを使用したモノレポ構造になっています。

## 機能 (Features)
- **WebGPU レンダリング**: WGSLシェーダーを使用した高速な2Dレンダリングパイプライン。
- **ECS アーキテクチャ**: 純粋なデータ駆動型 Entity Component System (`World`, `Entity`, `System`, `Component`)。
- **バッチレンダラー**: テクスチャの自動バッチ処理とインスタンシングによる効率的なスプライト描画。
- **物理システム**: `BoxCollider` によるAABB衝突判定と解決。
- **解像度制御**: 「ピクセルパーフェクト」(Nearest Neighbor) とHDスケーリングモードをサポート。
- **テキスト描画**: `Text` コンポーネントを使用した動的なテキストのテクスチャ生成。
- **入力管理**: 使いやすいキーボードとマウスの入力ハンドリング。

## 構造

- `packages/engine` (`@my-engine/core`): コアゲームエンジンライブラリ (OSS)。
- `apps/private-game`: エンジンを使用したサンプルゲーム実装。

## 始め方

1. **依存関係のインストール**
   ```bash
   npm install
   ```

2. **開発サーバーの起動**
   サンプルゲームを起動します:
   ```bash
   npm run dev
   ```

3. **エンジンのビルド**
   エンジンパッケージを手動でビルドする場合:
   ```bash
   npm run build
   ```

## 技術スタック
- TypeScript
- WebGPU
- Vite
- tsup (エンジンのバンドル用)
- npm workspaces

## ライセンス
MIT
