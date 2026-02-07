import { IWorld } from '../ecs/types';
import { ResourceManager } from '../core/ResourceManager';
import { ComponentRegistry } from './ComponentRegistry';


// JSON Schema Types
export interface SceneData {
    name?: string;
    assets?: {
        images?: Record<string, { path: string }>;
        audio?: Record<string, { path: string; group: 'BGM' | 'SE' | 'VOICE' }>;
    };
    entities: EntityData[];
}

export interface EntityData {
    id?: string;
    components: ComponentData[];
}

export interface ComponentData {
    type: string;
    props?: Record<string, any>;
}

export class SceneLoader {
    private world: IWorld;
    private resourceManager: ResourceManager;

    constructor(world: IWorld, resourceManager: ResourceManager) {
        this.world = world;
        this.resourceManager = resourceManager;
    }

    public async loadScene(data: SceneData): Promise<void> {
        // 1. Load Assets
        if (data.assets) {
            // Map string group to enum if necessary, or ensure store accepts string
            // Assuming AudioStore uses string or compatible type for group
            // Type assertion might be needed if AudioGroup is strict enum

            // For now, pass directly as implementation plan mostly used loose types or need casting
            await this.resourceManager.loadManifest(data.assets as any);
        }

        // 2. Create Entities
        const registry = ComponentRegistry.getInstance();

        for (const entityData of data.entities) {
            const entity = this.world.createEntity();

            // TODO: Handle entity ID if World supports tagged entities or lookups
            // The current simple ECS might not have ID lookup map exposed.
            // For now, we just create the entity.

            for (const compData of entityData.components) {
                const Ctor = registry.get(compData.type);
                if (Ctor) {
                    // Instantiate component
                    // We assume component has a parameterless constructor OR we try to inject props directly?
                    // Most components in this engine seem to have arguments.
                    // Ideally, we should create instance and then assign props.
                    // Or we force components to have default constructor?

                    // Strategy: Instantiate with no args (if possible) or undefined, then assign props.
                    // TypeScript might complain about missing args if strictly typed.
                    // We can cast to 'any' to instantiate.
                    const component = new (Ctor as any)();

                    if (compData.props) {
                        Object.assign(component, compData.props);
                    }

                    this.world.addComponent(entity, component);
                } else {
                    console.warn(`Component type '${compData.type}' not found in registry.`);
                }
            }
        }
    }
}
