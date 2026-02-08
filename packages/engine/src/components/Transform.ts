import { Component } from '../ecs/Component';

export class Transform extends Component {
    public x: number = 0;
    public y: number = 0;
    private _scale: [number, number] = [1, 1];

    constructor(x: number = 0, y: number = 0) {
        super();
        this.x = x;
        this.y = y;
    }

    get scale(): [number, number] {
        return this._scale;
    }

    set scale(value: [number, number] | { x: number, y: number } | number) {
        if (typeof value === 'number') {
            this._scale = [value, value];
        } else if (Array.isArray(value)) {
            this._scale = value;
        } else {
            this._scale = [value.x, value.y];
        }
    }
}
