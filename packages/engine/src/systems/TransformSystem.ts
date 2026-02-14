import { System } from '../ecs/System';
import { IWorld } from '../ecs/types';
import { Transform } from '../components/Transform';

export class TransformSystem extends System {
    private world!: IWorld;

    public init(world: IWorld): void {
        this.world = world;
        // Run very early, before Physics(500) and Renderer(1000)
        this.priority = 100;
    }

    public update(_dt: number): void {
        const entities = this.world.query(Transform);

        // 1. Identify Root Transforms (No Parent)
        // Optimization: In a real engine, we might mask roots or keep a list.
        // Here we iterate all.

        for (const entity of entities) {
            const transform = this.world.getComponent(entity, Transform);
            if (!transform) continue;

            // Start update from roots
            if (transform.parent === null) {
                this.updateTransform(transform);
            }
        }
    }

    private updateTransform(transform: Transform): void {
        // Calculate World Transform
        if (transform.parent) {
            const parent = transform.parent;

            // 1. Scale
            transform._worldScaleX = parent._worldScaleX * transform.scale[0];
            transform._worldScaleY = parent._worldScaleY * transform.scale[1];

            // 2. Rotation
            transform._worldRotation = parent._worldRotation + transform.rotation;

            // 3. Position (Rotate local offset by parent rotation, scale by parent scale, translate by parent pos)
            // Local Offset (Scaled by parent scale)
            const lx = transform.x * parent._worldScaleX;
            const ly = transform.y * parent._worldScaleY;

            // Rotate
            const sin = Math.sin(parent._worldRotation);
            const cos = Math.cos(parent._worldRotation);

            const rotatedX = lx * cos - ly * sin;
            const rotatedY = lx * sin + ly * cos;

            // Translate
            transform._worldX = parent._worldX + rotatedX;
            transform._worldY = parent._worldY + rotatedY;
            transform._worldZ = parent._worldZ + transform.z;

        } else {
            // Root
            transform._worldX = transform.x;
            transform._worldY = transform.y;
            transform._worldZ = transform.z;
            transform._worldRotation = transform.rotation;
            transform._worldScaleX = transform.scale[0];
            transform._worldScaleY = transform.scale[1];
        }

        // Recursively update children
        for (const child of transform.children) {
            this.updateTransform(child);
        }
    }
}
