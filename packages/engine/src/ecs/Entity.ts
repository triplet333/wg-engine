/**
 * Entity is just a unique identifier (number).
 */
export type Entity = number;

/**
 * Manages the creation and destruction of entities (IDs).
 */
export class EntityManager {
    private nextId: Entity = 0;
    private availableIds: Entity[] = [];

    /**
     * Creates a new unique Entity ID.
     */
    public create(): Entity {
        if (this.availableIds.length > 0) {
            return this.availableIds.pop()!;
        }
        return this.nextId++;
    }

    /**
     * Recycles an Entity ID.
     */
    public destroy(entity: Entity): void {
        this.availableIds.push(entity);
    }

    /**
     * Resets the entity manager.
     */
    public clear(): void {
        this.nextId = 0;
        this.availableIds = [];
    }
}
