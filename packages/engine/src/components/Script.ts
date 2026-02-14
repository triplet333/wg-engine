import { Component } from '../ecs/Component';
import { Entity } from '../ecs/Entity';

export interface ScriptInstance {
    onStart?(): void;
    onUpdate?(dt: number): void;
    onCollisionEnter?(other: Entity): void;
    entity: Entity;
}

export class Script extends Component {
    public scriptName: string;
    public instance: ScriptInstance | null = null;

    constructor(scriptName: string = '') {
        super();
        this.scriptName = scriptName;
    }
}
