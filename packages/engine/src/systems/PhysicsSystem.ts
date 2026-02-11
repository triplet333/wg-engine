import { System } from '../ecs/System';
import { IWorld } from '../ecs/types';
import { Transform } from '../components/Transform';
import { BoxCollider } from '../components/BoxCollider';

export class PhysicsSystem extends System {
    private world!: IWorld;

    public init(world: IWorld): void {
        this.world = world;
        // Physics generally runs before movement (or after? usually update movement then resolve collision)
        // Let's assume input modifies transform, then Physics resolves constraints.
        this.priority = 500; // Run before Renderer (1000) but maybe after PlayerController?
    }

    public update(_dt: number): void {
        const colliders: { entity: number, transform: Transform, collider: BoxCollider }[] = [];

        const entitiesWithCollider = this.world.query(BoxCollider);
        for (const entity of entitiesWithCollider) {
            const transform = this.world.getComponent(entity, Transform);
            const collider = this.world.getComponent(entity, BoxCollider);
            if (transform && collider) {
                colliders.push({ entity, transform, collider });
            }
        }

        // Check for collisions
        for (let i = 0; i < colliders.length; i++) {
            const a = colliders[i];

            for (let j = i + 1; j < colliders.length; j++) {
                const b = colliders[j];

                if (this.checkAABB(a, b)) {
                    this.resolveCollision(a, b);
                }
            }
        }
    }

    private checkAABB(a: { transform: Transform, collider: BoxCollider }, b: { transform: Transform, collider: BoxCollider }): boolean {
        // A: effective size
        const aScaleX = Math.abs(a.transform._worldScaleX);
        const aScaleY = Math.abs(a.transform._worldScaleY);
        const aW = a.collider.width * aScaleX;
        const aH = a.collider.height * aScaleY;
        const aOffsetX = a.collider.offsetX * aScaleX;
        const aOffsetY = a.collider.offsetY * aScaleY;

        const aLeft = a.transform._worldX + aOffsetX;
        const aRight = aLeft + aW;
        const aTop = a.transform._worldY + aOffsetY;
        const aBottom = aTop + aH;

        // B: effective size
        const bScaleX = Math.abs(b.transform._worldScaleX);
        const bScaleY = Math.abs(b.transform._worldScaleY);
        const bW = b.collider.width * bScaleX;
        const bH = b.collider.height * bScaleY;
        const bOffsetX = b.collider.offsetX * bScaleX;
        const bOffsetY = b.collider.offsetY * bScaleY;

        const bLeft = b.transform._worldX + bOffsetX;
        const bRight = bLeft + bW;
        const bTop = b.transform._worldY + bOffsetY;
        const bBottom = bTop + bH;

        return (aLeft < bRight && aRight > bLeft && aTop < bBottom && aBottom > bTop);
    }

    private resolveCollision(a: { entity: number, transform: Transform, collider: BoxCollider }, b: { entity: number, transform: Transform, collider: BoxCollider }): void {
        if (a.collider.isTrigger || b.collider.isTrigger) return;
        if (a.collider.isStatic && b.collider.isStatic) return;

        // A Params
        const aScaleX = Math.abs(a.transform._worldScaleX);
        const aScaleY = Math.abs(a.transform._worldScaleY);
        const aW = a.collider.width * aScaleX;
        const aH = a.collider.height * aScaleY;
        const aOffsetX = a.collider.offsetX * aScaleX;
        const aOffsetY = a.collider.offsetY * aScaleY;
        const aLeft = a.transform._worldX + aOffsetX;
        const aTop = a.transform._worldY + aOffsetY;
        const aCenterX = aLeft + aW / 2;
        const aCenterY = aTop + aH / 2;

        // B Params
        const bScaleX = Math.abs(b.transform._worldScaleX);
        const bScaleY = Math.abs(b.transform._worldScaleY);
        const bW = b.collider.width * bScaleX;
        const bH = b.collider.height * bScaleY;
        const bOffsetX = b.collider.offsetX * bScaleX;
        const bOffsetY = b.collider.offsetY * bScaleY;
        const bLeft = b.transform._worldX + bOffsetX;
        const bTop = b.transform._worldY + bOffsetY;
        const bCenterX = bLeft + bW / 2;
        const bCenterY = bTop + bH / 2;

        const dx = bCenterX - aCenterX;
        const dy = bCenterY - aCenterY;

        // Min distance to separate
        const minDistX = (aW + bW) / 2;
        const minDistY = (aH + bH) / 2;

        if (Math.abs(dx) >= minDistX || Math.abs(dy) >= minDistY) return;

        const overlapX = minDistX - Math.abs(dx);
        const overlapY = minDistY - Math.abs(dy);

        // Helper to apply world delta to local transform
        const applyWorldDelta = (t: Transform, dx: number, dy: number) => {
            if (t.parent) {
                // Assuming simple scale (no rotation for now)
                t.x += dx / t.parent._worldScaleX;
                t.y += dy / t.parent._worldScaleY;
            } else {
                t.x += dx;
                t.y += dy;
            }
        };

        // Resolve along shallowest axis
        if (overlapX < overlapY) {
            const separation = overlapX;
            const dir = dx > 0 ? -1 : 1;

            if (a.collider.isStatic) {
                applyWorldDelta(b.transform, separation * -dir, 0);
            } else if (b.collider.isStatic) {
                applyWorldDelta(a.transform, separation * dir, 0);
            } else {
                applyWorldDelta(a.transform, (separation / 2) * dir, 0);
                applyWorldDelta(b.transform, (separation / 2) * -dir, 0);
            }
        } else {
            const separation = overlapY;
            const dir = dy > 0 ? -1 : 1;

            if (a.collider.isStatic) {
                applyWorldDelta(b.transform, 0, separation * -dir);
            } else if (b.collider.isStatic) {
                applyWorldDelta(a.transform, 0, separation * dir);
            } else {
                applyWorldDelta(a.transform, 0, (separation / 2) * dir);
                applyWorldDelta(b.transform, 0, (separation / 2) * -dir);
            }
        }
    }
}
