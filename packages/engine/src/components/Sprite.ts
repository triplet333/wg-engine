import { Component } from '../ecs/Component';

export class Sprite extends Component {
    // URL or ID of the texture
    public textureId: string;

    // Backing fields
    private _uvOffset: [number, number] = [0, 0];
    private _uvScale: [number, number] = [1, 1];

    constructor(textureId: string) {
        super();
        this.textureId = textureId;
    }

    get uvOffset(): [number, number] {
        return this._uvOffset;
    }

    set uvOffset(value: [number, number] | { x: number, y: number } | { u: number, v: number }) {
        if (Array.isArray(value)) {
            this._uvOffset = value;
        } else if ('u' in value) {
            this._uvOffset = [value.u, value.v];
        } else {
            this._uvOffset = [value.x, value.y];
        }
    }

    get uvScale(): [number, number] {
        return this._uvScale;
    }

    set uvScale(value: [number, number] | { x: number, y: number } | { u: number, v: number }) {
        if (Array.isArray(value)) {
            this._uvScale = value;
        } else if ('u' in value) {
            this._uvScale = [value.u, value.v];
        } else {
            this._uvScale = [value.x, value.y];
        }
    }
}
