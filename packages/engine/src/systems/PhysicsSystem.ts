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
        // const entities = this.world.query(Transform);
        // Naive O(N^2) check. For 5000 entities this is deadly. 
        // NOTE: In the stress test, we have 5000 moving entities. 
        // Collision checking ONLY entities with BoxCollider.
        // We should ensure we don't iterate 5000 random walkers if they don't have colliders.

        // Optimized query: Query BoxCollider first. 
        // However, our simple ECS query only takes one component right now (or iterates all).
        // Let's restart: iterating BoxCollider entities. (Component storage map iteration)

        // Since our query(Component) returns internal entity list which might be all entities if we don't have archetype filtering...
        // Wait, world.query(Class) iterates `this.entities` (SparseSet keys) and checks `hasComponent`.
        // A full scan is OK for small N, but bad for large N.

        // Optimization: Let's assume for now we only add colliders to the Player and the Cone, NOT the 5000 walkers.
        // So the list size will be small (2).

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
        // A: left, right, top, bottom
        const aLeft = a.transform.x + a.collider.offsetX;
        const aRight = aLeft + a.collider.width;
        const aTop = a.transform.y + a.collider.offsetY;
        const aBottom = aTop + a.collider.height;

        // B: left, right, top, bottom
        const bLeft = b.transform.x + b.collider.offsetX;
        const bRight = bLeft + b.collider.width;
        const bTop = b.transform.y + b.collider.offsetY;
        const bBottom = bTop + b.collider.height;

        return (aLeft < bRight && aRight > bLeft && aTop < bBottom && aBottom > bTop);
    }

    private resolveCollision(a: { entity: number, transform: Transform, collider: BoxCollider }, b: { entity: number, transform: Transform, collider: BoxCollider }): void {
        // Correct overlap by pushing out the non-static object.
        // If both are dynamic, push both away (half each).
        // If one is static, push the dynamic one fully.

        if (a.collider.isTrigger || b.collider.isTrigger) return;
        if (a.collider.isStatic && b.collider.isStatic) return;

        // Determine overlap amounts
        const aLeft = a.transform.x + a.collider.offsetX;
        const aTop = a.transform.y + a.collider.offsetY;
        const aW = a.collider.width;
        const aH = a.collider.height;
        const aCenterX = aLeft + aW / 2;
        const aCenterY = aTop + aH / 2;

        const bLeft = b.transform.x + b.collider.offsetX;
        const bTop = b.transform.y + b.collider.offsetY;
        const bW = b.collider.width;
        const bH = b.collider.height;
        const bCenterX = bLeft + bW / 2;
        const bCenterY = bTop + bH / 2;

        const dx = bCenterX - aCenterX;
        const dy = bCenterY - aCenterY;

        // Min distance to separate
        const minDistX = (aW + bW) / 2;
        const minDistY = (aH + bH) / 2;

        if (Math.abs(dx) >= minDistX || Math.abs(dy) >= minDistY) return; // Should allow checkAABB to catch it, but double check.

        const overlapX = minDistX - Math.abs(dx);
        const overlapY = minDistY - Math.abs(dy);

        // Resolve along shallowest axis
        if (overlapX < overlapY) {
            // X collision
            const separation = overlapX;
            const dir = dx > 0 ? -1 : 1; // Direction to push A away from B. If dx > 0 (B is right), push A left (-1)

            if (a.collider.isStatic) {
                // Push B
                b.transform.x += separation * -dir; // Push B opposite to A's push dir
            } else if (b.collider.isStatic) {
                // Push A
                a.transform.x += separation * dir;
            } else {
                // Push both
                a.transform.x += (separation / 2) * dir;
                b.transform.x += (separation / 2) * -dir;
            }
        } else {
            // Y collision
            const separation = overlapY;
            const dir = dy > 0 ? -1 : 1; // Direction to push A away from B

            if (a.collider.isStatic) {
                b.transform.y += separation * -dir;
            } else if (b.collider.isStatic) {
                a.transform.y += separation * dir;
            } else {
                a.transform.y += (separation / 2) * dir;
                b.transform.y += (separation / 2) * -dir;
            }
        }
    }
}
