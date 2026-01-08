import { Component, ComponentConstructor } from './Component';
import { Entity } from './Entity';
import type { System } from './System';

export interface IWorld {
    createEntity(): Entity;
    destroyEntity(entity: Entity): void;
    addComponent<T extends Component>(entity: Entity, component: T): T;
    getComponent<T extends Component>(entity: Entity, ctor: ComponentConstructor<T>): T | undefined;
    removeComponent<T extends Component>(entity: Entity, ctor: ComponentConstructor<T>): void;
    addSystem(system: System): void;
    query(componentType: ComponentConstructor): Entity[];
}
