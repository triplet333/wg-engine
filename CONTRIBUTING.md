# 貢献ガイドライン (Contributing)

Browser Game Engine への貢献に興味を持っていただきありがとうございます！
このプロジェクトは Monorepo 構成で管理されています。

## 開発環境のセットアップ

1. **リポジトリのクローン**
   ```bash
   git clone <repository-url>
   cd browser-game-engine
   ```

2. **依存関係のインストール**
   ```bash
   npm install
   ```

3. **開発サーバーの起動**
   サンプルゲーム (`apps/private-game`) を実行して動作確認を行います。
   ```bash
   npm run dev
   ```

## プロジェクト構造

- `packages/engine`: ゲームエンジンのコアロジック (@my-engine/core)
- `apps/private-game`: エンジンの動作確認用サンプルゲーム

## エンジンのビルド

エンジンのコードを変更した場合は、以下のコマンドでビルドを確認できます。

```bash
npm run build
```

`packages/engine` は `tsup` を使用してバンドルされます。

## プルリクエストの作成

1. Issue を作成して、変更内容を議論してください。
2. リポジトリをフォークし、ブランチを作成します。
3. 変更を行い、動作確認をします。
4. プルリクエストを作成します。

## コーディング規約

- TypeScript の標準的なスタイルに従ってください。
- コメントは可能な限り TSDoc 形式で記述してください。
