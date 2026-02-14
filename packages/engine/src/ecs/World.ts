import { Component, ComponentConstructor } from './Component';
import { Entity, EntityManager } from './Entity';
import { System } from './System';
import { IWorld } from './types';

export class World implements IWorld {
    private entityManager = new EntityManager();
    private systems: System[] = [];

    // Storage: Map<ComponentConstructor, Map<Entity, ComponentInstance>>
    private components = new Map<ComponentConstructor, Map<Entity, Component>>();

    private disabledEntities = new Set<Entity>();

    /**
     * Creates a new entity in the world.
     * @returns The newly created Entity.
     */
    public createEntity(): Entity {
        return this.entityManager.create();
    }

    /**
     * Destroys an entity and removes all its components.
     * @param entity - The entity to destroy.
     */
    public destroyEntity(entity: Entity): void {
        this.entityManager.destroy(entity);
        this.disabledEntities.delete(entity);
        // Remove all components for this entity
        for (const [_, entityMap] of this.components) {
            entityMap.delete(entity);
        }
    }

    /**
     * Clears all entities, components, and systems from the world.
     */
    public clear(): void {
        this.entityManager.clear();
        this.components.clear();
        this.disabledEntities.clear();
        this.systems = []; // Clear systems to allow Scenes to define their own pipelines
    }

    /**
     * Adds a component to an entity.
     * @param entity - The entity to add the component to.
     * @param component - The component instance to add.
     * @returns The added component.
     */
    public addComponent<T extends Component>(entity: Entity, component: T): T {
        const ctor = component.constructor as ComponentConstructor<T>;
        if (!this.components.has(ctor)) {
            this.components.set(ctor, new Map());
        }
        this.components.get(ctor)!.set(entity, component);
        return component;
    }

    /**
     * Retrieves a component from an entity.
     * @param entity - The entity to get the component from.
     * @param ctor - The constructor of the component type.
     * @returns The component instance, or undefined if not found.
     */
    public getComponent<T extends Component>(entity: Entity, ctor: ComponentConstructor<T>): T | undefined {
        const entityMap = this.components.get(ctor);
        if (!entityMap) return undefined;
        return entityMap.get(entity) as T | undefined;
    }

    /**
     * Removes a component from an entity.
     * @param entity - The entity to remove the component from.
     * @param ctor - The constructor of the component type to remove.
     */
    public removeComponent<T extends Component>(entity: Entity, ctor: ComponentConstructor<T>): void {
        const entityMap = this.components.get(ctor);
        if (entityMap) {
            entityMap.delete(entity);
        }
    }

    /**
     * Adds a system to the world. Systems are updated in the order of their priority.
     * @param system - The system to add.
     */
    public addSystem(system: System): void {
        system.init(this);
        this.systems.push(system);
        this.systems.sort((a, b) => a.priority - b.priority);
    }

    /**
     * Updates all systems in the world.
     * @param dt - The delta time in seconds since the last frame.
     */
    public update(dt: number): void {
        for (const system of this.systems) {
            system.update(dt);
        }
    }

    /**
     * Sets the active state of an entity.
     * Inactive entities are excluded from World.query() by default.
     * @param entity - The entity to update.
     * @param active - True to enable, false to disable.
     */
    public setActive(entity: Entity, active: boolean): void {
        if (active) {
            this.disabledEntities.delete(entity);
        } else {
            this.disabledEntities.add(entity);
        }
    }

    /**
     * Checks if an entity is active.
     * @param entity - The entity to check.
     * @returns True if active, false if disabled.
     */
    public isActive(entity: Entity): boolean {
        return !this.disabledEntities.has(entity);
    }

    /**
     * Simple query to get all entities that have a specific component type.
     * For multiple components, we can intersect sets (naive implementation).
     * @param componentType - The component constructor to filter by.
     * @returns An array of entities that have the specified component.
     */
    public query(componentType: ComponentConstructor): Entity[] {
        const entityMap = this.components.get(componentType);
        if (!entityMap) return [];

        // Filter out disabled entities
        // Optimization: If no entities are disabled, return keys directly (avoids filter overhead)
        if (this.disabledEntities.size === 0) {
            return Array.from(entityMap.keys());
        }

        const entities: Entity[] = [];
        for (const entity of entityMap.keys()) {
            if (!this.disabledEntities.has(entity)) {
                entities.push(entity);
            }
        }
        return entities;
    }
}
