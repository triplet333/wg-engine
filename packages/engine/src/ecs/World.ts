import { Component, ComponentConstructor } from './Component';
import { Entity, EntityManager } from './Entity';
import { System } from './System';
import { IWorld } from './types';

export class World implements IWorld {
    private entityManager = new EntityManager();
    private systems: System[] = [];

    // Storage: Map<ComponentConstructor, Map<Entity, ComponentInstance>>
    private components = new Map<ComponentConstructor, Map<Entity, Component>>();

    public createEntity(): Entity {
        return this.entityManager.create();
    }

    public destroyEntity(entity: Entity): void {
        this.entityManager.destroy(entity);
        // Remove all components for this entity
        for (const [_, entityMap] of this.components) {
            entityMap.delete(entity);
        }
    }

    public addComponent<T extends Component>(entity: Entity, component: T): T {
        const ctor = component.constructor as ComponentConstructor<T>;
        if (!this.components.has(ctor)) {
            this.components.set(ctor, new Map());
        }
        this.components.get(ctor)!.set(entity, component);
        return component;
    }

    public getComponent<T extends Component>(entity: Entity, ctor: ComponentConstructor<T>): T | undefined {
        const entityMap = this.components.get(ctor);
        if (!entityMap) return undefined;
        return entityMap.get(entity) as T | undefined;
    }

    public removeComponent<T extends Component>(entity: Entity, ctor: ComponentConstructor<T>): void {
        const entityMap = this.components.get(ctor);
        if (entityMap) {
            entityMap.delete(entity);
        }
    }

    public addSystem(system: System): void {
        system.init(this);
        this.systems.push(system);
        this.systems.sort((a, b) => a.priority - b.priority);
    }

    public update(dt: number): void {
        for (const system of this.systems) {
            system.update(dt);
        }
    }

    /**
     * Simple query to get all entities that have a specific component type.
     * For multiple components, we can intersect sets (naive implementation).
     */
    public query(componentType: ComponentConstructor): Entity[] {
        const entityMap = this.components.get(componentType);
        if (!entityMap) return [];
        return Array.from(entityMap.keys());
    }
}
