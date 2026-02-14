import { System } from '../ecs/System';
import { IWorld } from '../ecs/types';
import { Script } from '../components/Script';
import { PhysicsSystem } from './PhysicsSystem';

export class ScriptSystem extends System {
    private world!: IWorld;
    private physicsSystem: PhysicsSystem | undefined;
    private scriptFactories: Map<string, (entity: number) => any> = new Map();

    public init(world: IWorld): void {
        this.world = world;
        this.priority = 200; // After Input, before Physics? Or after Physics?
        // Logic Update -> Physics -> CollisionScript

        // Find PhysicsSystem to listen for collisions
        // Note: engines usually allow system-to-system communication or shared resources.
        // We'll try to find it from the world if possible, or expect it to be passed?
        // For now, let's assume we can find it in the world's systems list if we had access.
        // But World interface is generic.
        // Let's assume we can inject it or find it. 
        // TEMPORARY: We will rely on the user registering ScriptSystem AFTER PhysicsSystem,
        // and we will look for it?
        // Actually, we can just process script updates here.
        // Collisions: we need to access PhysicsSystem.collisions.
        // We can pass PhysicsSystem in constructor or setters.
    }

    public setPhysicsSystem(physics: PhysicsSystem) {
        this.physicsSystem = physics;
    }

    public registerScript(name: string, factory: (entity: number) => any) {
        this.scriptFactories.set(name, factory);
    }

    public update(dt: number): void {
        const entities = this.world.query(Script);

        // 1. Instantiate Scripts if needed
        for (const entity of entities) {
            const scriptComp = this.world.getComponent(entity, Script);
            if (scriptComp && !scriptComp.instance && scriptComp.scriptName) {
                const factory = this.scriptFactories.get(scriptComp.scriptName);
                if (factory) {
                    scriptComp.instance = factory(entity);
                    if (scriptComp.instance) {
                        scriptComp.instance.entity = entity as any; // Type hack if needed, or Factory handles it
                        if (scriptComp.instance.onStart) {
                            scriptComp.instance.onStart();
                        }
                    }
                } else {
                    console.warn(`Script factory for '${scriptComp.scriptName}' not found.`);
                }
            }
        }

        // 2. Update Scripts
        for (const entity of entities) {
            const scriptComp = this.world.getComponent(entity, Script);
            if (scriptComp && scriptComp.instance && scriptComp.instance.onUpdate) {
                scriptComp.instance.onUpdate(dt);
            }
        }

        // 3. Handle Collisions
        if (this.physicsSystem) {
            for (const collision of this.physicsSystem.collisions) {
                if (collision.started) {
                    this.notifyCollision(collision.entityA, collision.entityB);
                    this.notifyCollision(collision.entityB, collision.entityA);
                }
            }
        }
    }

    private notifyCollision(entity: number, other: number) {
        const scriptComp = this.world.getComponent(entity, Script);
        if (scriptComp && scriptComp.instance && scriptComp.instance.onCollisionEnter) {
            scriptComp.instance.onCollisionEnter(other as any);
        }
    }
}
