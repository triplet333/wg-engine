import { Component } from '../ecs/Component';

export class Transform extends Component {
    public x: number = 0;
    public y: number = 0;
    public scale: [number, number] = [1, 1];

    constructor(x: number = 0, y: number = 0) {
        super();
        this.x = x;
        this.y = y;
    }
}
