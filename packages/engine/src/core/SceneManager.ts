import { World } from '../ecs/World';
import { Scene } from './Scene';
import { ResourceManager } from './ResourceManager';

export class SceneManager {
    public currentScene: Scene | null = null;
    public world: World;
    public resourceManager: ResourceManager;

    constructor(world: World, resourceManager: ResourceManager) {
        this.world = world;
        this.resourceManager = resourceManager;
    }

    public async switchScene(newScene: Scene): Promise<void> {
        // 1. Exit current scene
        if (this.currentScene) {
            this.currentScene.onExit(this.world);
        }

        // 2. Clear World
        this.world.clear();

        // 3. Enter New Scene
        // Note: Preloading is now the responsibility of the caller (e.g., LoadingScene)
        // or the scene itself before calling switchScene if manual.

        this.currentScene = newScene;
        newScene.onEnter(this.world);
    }
}
