import { Component } from '../ecs/Component';

export class Renderable extends Component {
    public color: [number, number, number, number]; // RGBA

    constructor(r: number, g: number, b: number, a: number = 1.0) {
        super();
        this.color = [r, g, b, a];
    }
}
