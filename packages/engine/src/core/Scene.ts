import { IWorld } from '../ecs/types';
import { ResourceManager } from './ResourceManager';

export interface Scene {
    /**
     * Called when the scene is entered.
     * @param world The ECS World instance.
     */
    onEnter(world: IWorld): void;

    /**
     * Called when leave the scene.
     * @param world The ECS World instance.
     */
    onExit(world: IWorld): void;

    /**
     * Optional preload method to load assets before entering the scene.
     * @param resourceManager The ResourceManager instance.
     */
    preload?(resourceManager: ResourceManager): Promise<void>;
}
