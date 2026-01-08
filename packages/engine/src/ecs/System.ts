import { IWorld } from './types';

export abstract class System {
    // Priority for execution order (lower runs first)
    public priority: number = 0;

    /**
     * Called once when the system is added to the world
     */
    public init(_world: IWorld): void { }

    /**
     * Called every frame
     * @param dt Delta time in seconds
     */
    public abstract update(dt: number): void;
}
