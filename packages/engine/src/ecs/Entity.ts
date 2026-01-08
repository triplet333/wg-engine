export type Entity = number;

export class EntityManager {
    private nextId: Entity = 0;
    private availableIds: Entity[] = [];

    public create(): Entity {
        if (this.availableIds.length > 0) {
            return this.availableIds.pop()!;
        }
        return this.nextId++;
    }

    public destroy(entity: Entity): void {
        this.availableIds.push(entity);
    }
}
