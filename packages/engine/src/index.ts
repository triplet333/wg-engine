import { World } from './ecs/World';

export * from './ecs';
export * from './components/Transform';
export * from './components/Camera';
export * from './components/Text';
export * from './components/BoxCollider';
export * from './systems/PhysicsSystem';
// Other components like Sprite/Renderable moved to specific exports or separate

export class Game {
    public world: World;

    private lastTime: number = 0;
    private animationFrameId: number | null = null;
    private running: boolean = false;

    constructor() {
        this.world = new World();
    }

    public start(): void {
        if (this.running) return;
        this.running = true;
        this.lastTime = performance.now();
        this.animationFrameId = requestAnimationFrame(this.loop);
    }

    public stop(): void {
        this.running = false;
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    private loop = (time: number): void => {
        if (!this.running) return;

        // Calculate delta time in seconds
        const dt = (time - this.lastTime) / 1000;
        this.lastTime = time;

        // Update all systems
        this.world.update(dt);

        this.animationFrameId = requestAnimationFrame(this.loop);
    };
}
