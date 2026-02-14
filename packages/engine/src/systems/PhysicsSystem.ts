import { System } from '../ecs/System';
import { IWorld } from '../ecs/types';
import { Transform } from '../components/Transform';
import { BoxCollider } from '../components/BoxCollider';
import { RigidBody } from '../components/RigidBody';

export interface CollisionEvent {
    entityA: number;
    entityB: number;
    started: boolean; // True if this is the first frame of collision (Enter) - For now simplified to "Is Colliding"
}

export class PhysicsSystem extends System {
    private world!: IWorld;
    public gravity: { x: number, y: number } = { x: 0, y: 980 }; // Default gravity (pixels/s^2)

    // Shared state for ScriptSystem to read
    public collisions: CollisionEvent[] = [];

    public init(world: IWorld): void {
        this.world = world;
        this.priority = 500;
    }

    public update(dt: number): void {
        this.collisions = []; // Clear previous frame collisions

        // 1. Integration (Move Dynamic Bodies)
        const dynamicBodies = this.world.query(RigidBody);
        for (const entity of dynamicBodies) {
            const body = this.world.getComponent(entity, RigidBody);
            const transform = this.world.getComponent(entity, Transform);

            if (body && transform) {
                // Apply Gravity
                body.velocity[0] += this.gravity.x * body.gravityScale * dt;
                body.velocity[1] += this.gravity.y * body.gravityScale * dt;

                // Apply Velocity
                transform.x += body.velocity[0] * dt;
                transform.y += body.velocity[1] * dt;
            }
        }

        // 2. Collision Detection & Resolution
        const colliders: { entity: number, transform: Transform, collider: BoxCollider }[] = [];
        const entitiesWithCollider = this.world.query(BoxCollider);

        for (const entity of entitiesWithCollider) {
            const transform = this.world.getComponent(entity, Transform);
            const collider = this.world.getComponent(entity, BoxCollider);
            if (transform && collider) {
                colliders.push({ entity, transform, collider });
            }
        }

        // Check pairs
        for (let i = 0; i < colliders.length; i++) {
            const a = colliders[i];

            for (let j = i + 1; j < colliders.length; j++) {
                const b = colliders[j];

                if (this.checkAABB(a, b)) {
                    // Record Collision
                    this.collisions.push({ entityA: a.entity, entityB: b.entity, started: true });

                    // Resolve if not Trigger and not Static-Static
                    if (!a.collider.isTrigger && !b.collider.isTrigger && !(a.collider.isStatic && b.collider.isStatic)) {
                        this.resolveCollision(a, b);
                    }
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
        // Re-calc bounds (could optimize by caching)
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

        const overlapX = minDistX - Math.abs(dx);
        const overlapY = minDistY - Math.abs(dy);

        // Helper to apply world delta to local transform
        // NOTE: This assumes World Rotation is 0 for correct AABB response.
        // If rotated, this is an approximation.
        const applyWorldDelta = (t: Transform, dx: number, dy: number) => {
            if (t.parent) {
                t.x += dx / t.parent._worldScaleX;
                t.y += dy / t.parent._worldScaleY;
            } else {
                t.x += dx;
                t.y += dy;
            }
        };

        const updateVelocity = (entId: number, normal: { x: number, y: number }) => {
            const body = this.world.getComponent(entId, RigidBody);
            if (body) {
                // Zero out velocity against normal
                if (normal.x !== 0) body.velocity[0] = 0;
                if (normal.y !== 0) body.velocity[1] = 0;
            }
        }

        // Resolve along shallowest axis
        if (overlapX < overlapY) {
            const separation = overlapX;
            const dir = dx > 0 ? -1 : 1;
            const normal = { x: dir, y: 0 };

            if (a.collider.isStatic) {
                applyWorldDelta(b.transform, separation * -dir, 0);
                updateVelocity(b.entity, { x: -dir, y: 0 });
            } else if (b.collider.isStatic) {
                applyWorldDelta(a.transform, separation * dir, 0);
                updateVelocity(a.entity, normal);
            } else {
                applyWorldDelta(a.transform, (separation / 2) * dir, 0);
                applyWorldDelta(b.transform, (separation / 2) * -dir, 0);
                updateVelocity(a.entity, normal);
                updateVelocity(b.entity, { x: -dir, y: 0 });
            }
        } else {
            const separation = overlapY;
            const dir = dy > 0 ? -1 : 1;
            const normal = { x: 0, y: dir };

            if (a.collider.isStatic) {
                applyWorldDelta(b.transform, 0, separation * -dir);
                updateVelocity(b.entity, { x: 0, y: -dir });
            } else if (b.collider.isStatic) {
                applyWorldDelta(a.transform, 0, separation * dir);
                updateVelocity(a.entity, normal);
            } else {
                applyWorldDelta(a.transform, 0, (separation / 2) * dir);
                applyWorldDelta(b.transform, 0, (separation / 2) * -dir);
                updateVelocity(a.entity, normal);
                updateVelocity(b.entity, { x: 0, y: -dir });
            }
        }
    }
}
