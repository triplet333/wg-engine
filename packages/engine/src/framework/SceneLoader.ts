import { IWorld } from '../ecs/types';
import { ResourceManager } from '../core/ResourceManager';
import { ComponentRegistry } from './ComponentRegistry';


// JSON Schema Types
export interface SceneData {
    name?: string;
    assets?: {
        images?: Record<string, { path: string }>;
        audio?: Record<string, { path: string; group: 'BGM' | 'SE' | 'VOICE' }>;
        fonts?: Record<string, { path: string }>;
    };
    entities: EntityData[];
    ui?: EntityData[];
}

export interface EntityData {
    id?: string;
    components: ComponentData[];
    children?: EntityData[];
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

    public async loadScene(data: SceneData): Promise<Map<string, number>> {
        // 1. Load Assets
        if (data.assets) {
            await this.resourceManager.loadManifest(data.assets as any);
        }

        // 2. Create Entities
        const registry = ComponentRegistry.getInstance();
        const entityMap = new Map<string, number>();

        for (const entityData of data.entities) {
            this.createEntityRecursive(entityData, null, registry, entityMap);
        }

        // 3. Create UI Entities (if any)
        if (data.ui) {
            for (const entityData of data.ui) {
                this.createEntityRecursive(entityData, null, registry, entityMap);
                // Note: UI entities are just entities with specific Components (Camera, Layer, etc.)
                // They are processed same as normal entities.
            }
        }

        return entityMap;
    }

    private createEntityRecursive(entityData: EntityData, parentTransform: any, registry: any, entityMap: Map<string, number>): void {
        const entity = this.world.createEntity();
        if (entityData.id) {
            entityMap.set(entityData.id, entity);
        }

        let currentTransform: any = null;

        for (const compData of entityData.components) {
            const Ctor = registry.get(compData.type);
            if (Ctor) {
                const component = new (Ctor as any)();
                if (compData.props) {
                    Object.assign(component, compData.props);
                }
                this.world.addComponent(entity, component);

                // Identify Transform
                if (component.constructor.name === 'Transform') {
                    currentTransform = component;
                }
            } else {
                console.warn(`Component type '${compData.type}' not found in registry.`);
            }
        }

        // Link Hierarchy
        if (parentTransform && currentTransform) {
            currentTransform.parent = parentTransform;
            parentTransform.addChild(currentTransform); // Use addChild helper
        }

        // Process Children
        if (entityData.children) {
            for (const childData of entityData.children) {
                this.createEntityRecursive(childData, currentTransform, registry, entityMap);
            }
        }
    }
}
