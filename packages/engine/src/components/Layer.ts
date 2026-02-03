import { Component } from '../ecs/Component';

export class Layer extends Component {
    public name: string;
    public order: number;

    constructor(name: string = 'Default', order: number = 0) {
        super();
        this.name = name;
        this.order = order;
    }
}
