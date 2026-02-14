import { System } from '../ecs/System';
import { IWorld } from '../ecs/types';
import { ResourceManager } from '../core/ResourceManager';
import { Transform } from '../components/Transform';
import { BoxCollider } from '../components/BoxCollider';
import { Renderable } from '../components/Renderable';
import { Sprite } from '../components/Sprite';
import { Layer } from '../components/Layer';

export class PhysicsDebugSystem extends System {
    private world!: IWorld;
    private resourceManager: ResourceManager;
    private debugEntities: Map<number, number> = new Map(); // Collider Entity ID -> Debug Entity ID
    private textureId: string = 'z_debug_white';

    constructor(resourceManager: ResourceManager) {
        super();
        this.resourceManager = resourceManager;
        this.priority = 900; // Run late (but before Renderer which is 1000)
    }

    public init(world: IWorld): void {
        this.world = world;

        // Load White Pixel Texture
        const whitePixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAA1JREFUGFdj+P///38ACfsD/QVDRcoAAAAASUVORK5CYII=';
        this.resourceManager.textures.load(this.textureId, whitePixel);
    }

    public update(_dt: number): void {
        const colliders = this.world.query(BoxCollider);
        const processed = new Set<number>();

        for (const entity of colliders) {
            processed.add(entity);

            let debugEntity = this.debugEntities.get(entity);
            if (!debugEntity) {
                // Create Debug Entity
                debugEntity = this.world.createEntity();
                this.world.addComponent(debugEntity, new Transform());
                this.world.addComponent(debugEntity, new Renderable(1, 0, 0, 0.5)); // Red, 50% opacity

                const sprite = new Sprite(this.textureId);
                sprite.anchor = [0, 0]; // AABB is top-left based usually? 
                // Wait, BoxCollider logic checks:
                // aLeft = a.transform._worldX + aOffsetX
                // So it depends on Transform pivot? 
                // Standard Transform pivot is Top-Left (0,0)?
                // Sprite component has anchor. Transform doesn't specify pivot.
                // Renderer uses Transform position as Top-Left of the quad usually,
                // UNLESS Sprite anchor is used.
                // If Sprite anchor is (0,0), then valid.
                this.world.addComponent(debugEntity, sprite);

                // Add to same layer as target? Or "Debug"?
                // If I add "Debug" layer, Camera must see it.
                // For simplicity, match target layer or default.
                // Let's use Layer 10 (arbitrary high) and hope Camera sees "Default"?
                // Actually if I put it on "Default" layer (or 0), it shows up.
                // Let's assume Layer 0 for now.
                // Or copy layer from target?
                const targetLayer = this.world.getComponent(entity, Layer);
                if (targetLayer) {
                    this.world.addComponent(debugEntity, new Layer(targetLayer.name));
                } else {
                    this.world.addComponent(debugEntity, new Layer('Default')); // Or whatever logic
                }

                this.debugEntities.set(entity, debugEntity);
            }

            // Sync Transform
            const collider = this.world.getComponent(entity, BoxCollider);
            const transform = this.world.getComponent(entity, Transform);
            const debugTransform = this.world.getComponent(debugEntity, Transform);

            if (collider && transform && debugTransform) {
                // Calculate AABB in World Space
                const scaleX = Math.abs(transform._worldScaleX);
                const scaleY = Math.abs(transform._worldScaleY);
                const width = collider.width * scaleX;
                const height = collider.height * scaleY;
                const offsetX = collider.offsetX * scaleX;
                const offsetY = collider.offsetY * scaleY;

                debugTransform.x = transform._worldX + offsetX;
                debugTransform.y = transform._worldY + offsetY;

                // Set Local Scale using setter
                debugTransform.scale = [width, height];
                debugTransform.rotation = 0; // AABB is always axis aligned

                // Manually update world properties for immediate rendering
                debugTransform._worldX = debugTransform.x;
                debugTransform._worldY = debugTransform.y;
                debugTransform._worldScaleX = width;
                debugTransform._worldScaleY = height;
                debugTransform._worldRotation = 0;
            }
        }

        // Cleanup stale debug entities
        for (const [entity, debugEntity] of this.debugEntities) {
            if (!processed.has(entity)) {
                this.world.destroyEntity(debugEntity);
                this.debugEntities.delete(entity);
            }
        }
    }
}
