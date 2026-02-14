import { Component } from '../ecs/Component';

export class RigidBody extends Component {
    public velocity: [number, number] = [0, 0];
    public gravityScale: number = 1.0;
    public mass: number = 1.0;

    constructor() {
        super();
    }
}
