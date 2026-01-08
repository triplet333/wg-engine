# Browser Game Engine (Monorepo)

[English](README.md) | [日本語](README.jp.md)

This project is a TypeScript-based browser game engine inspired by simple 2D game loops. It is structured as a monorepo using npm workspaces.

## Features
- **WebGPU Rendering**: High-performance 2D rendering pipeline using WGSL shaders.
- **ECS Architecture**: Pure data-driven Entity Component System (`World`, `Entity`, `System`, `Component`).
- **Batch Renderer**: Efficient sprite rendering with automatic texture batching and instancing.
- **Physics System**: AABB-based collision detection and resolution with `BoxCollider`.
- **Resolution Control**: Supports "Pixel Perfect" (Nearest Neighbor) and HD scaling modes.
- **Text Rendering**: Dynamic text-to-texture generation using `Text` component.
- **Input Management**: Easy-to-use keyboard and mouse input handling.

## Structure

- `packages/engine` (`@my-engine/core`): The core game engine library (OSS).
- `apps/private-game`: A private game implementation using the engine (Example).

## Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Run Development Server**
   Start the example game:
   ```bash
   npm run dev
   ```

3. **Build Engine**
   To build the engine package manually:
   ```bash
   npm run build
   ```

## Tech Stack
- TypeScript
- WebGPU
- Vite
- tsup (for bundling the engine)
- npm workspaces

## License
MIT
