import { Component } from '../ecs/Component';

export class Renderable extends Component {
    private _color: [number, number, number, number]; // RGBA

    public visible: boolean = true;

    constructor(r: number = 1, g: number = 1, b: number = 1, a: number = 1.0) {
        super();
        this._color = [r, g, b, a];
    }

    get color(): [number, number, number, number] {
        return this._color;
    }

    set color(value: [number, number, number, number] | { r: number, g: number, b: number, a?: number }) {
        if (Array.isArray(value)) {
            this._color = value;
        } else {
            this._color = [value.r, value.g, value.b, value.a ?? 1.0];
        }
    }
}
