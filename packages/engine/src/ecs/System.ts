import { IWorld } from './types';

/**
 * Base class for all Systems.
 * Systems contain logic and operate on Entities with specific Components.
 */
export abstract class System {
    /**
     * Priority for execution order (lower runs first).
     * Default is 0.
     */
    public priority: number = 0;

    /**
     * Called once when the system is added to the world.
     * @param _world - The world instance.
     */
    public init(_world: IWorld): void { }

    /**
     * Called every frame.
     * @param dt - Delta time in seconds since the last frame.
     */
    public abstract update(dt: number): void;
}
