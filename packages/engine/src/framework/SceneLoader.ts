import { IWorld } from '../ecs/types';
import { ResourceManager } from '../core/ResourceManager';
import { ComponentRegistry } from './ComponentRegistry';
import { InputManager, InputBinding } from '../core/InputManager';


// JSON Schema Types
export interface SceneData {
    name?: string;
    assets?: {
        images?: Record<string, { path: string }>;
        audio?: Record<string, { path: string; group: 'BGM' | 'SE' | 'VOICE' }>;
        fonts?: Record<string, { path: string }>;
        bitmapFonts?: Record<string, { fnt: string, texture: string }>;
        openTypeFonts?: Record<string, { path: string }>;
    };
    entities: EntityData[];
    ui?: EntityData[];
    input?: Record<string, InputBinding>;
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
    private inputManager?: InputManager;

    constructor(world: IWorld, resourceManager: ResourceManager, inputManager?: InputManager) {
        this.world = world;
        this.resourceManager = resourceManager;
        this.inputManager = inputManager;
    }

    public async loadScene(data: SceneData, basePathOrResolver: string | ((path: string) => string) = ''): Promise<Map<string, number>> {
        // Resolve Helper
        const resolve = (p: string): string => {
            if (typeof basePathOrResolver === 'function') {
                return basePathOrResolver(p);
            }

            const base = basePathOrResolver;
            if (!base) return p;
            if (p.startsWith('http') || p.startsWith('/')) return p; // Absolute paths ignored if using basePath string
            const cleanBase = base.endsWith('/') ? base : base + '/';
            const cleanPath = p.startsWith('./') ? p.substring(2) : p;
            return cleanBase + cleanPath;
        };

        // 0. Setup Input
        if (data.input && this.inputManager) {
            for (const [action, binding] of Object.entries(data.input)) {
                // Input binding might need adjustment? Usually not.
                this.inputManager.bindAction(action, binding);
            }
        }

        // 1. Load Assets with resolution
        if (data.assets) {
            const assets = JSON.parse(JSON.stringify(data.assets)); // Deep copy to avoid mutating original JSON

            if (assets.images) {
                for (const key in assets.images) assets.images[key].path = resolve(assets.images[key].path);
            }
            if (assets.audio) {
                for (const key in assets.audio) assets.audio[key].path = resolve(assets.audio[key].path);
            }
            if (assets.fonts) {
                for (const key in assets.fonts) assets.fonts[key].path = resolve(assets.fonts[key].path);
            }
            if (assets.bitmapFonts) {
                for (const key in assets.bitmapFonts) {
                    assets.bitmapFonts[key].fnt = resolve(assets.bitmapFonts[key].fnt);
                    assets.bitmapFonts[key].texture = resolve(assets.bitmapFonts[key].texture);
                }
            }
            if (assets.openTypeFonts) {
                for (const key in assets.openTypeFonts) assets.openTypeFonts[key].path = resolve(assets.openTypeFonts[key].path);
            }

            await this.resourceManager.loadManifest(assets as any);
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
