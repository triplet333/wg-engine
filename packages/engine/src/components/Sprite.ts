import { Component } from '../ecs/Component';

export class Sprite extends Component {
    // URL or ID of the texture
    public textureId: string;
    public uvOffset: [number, number] = [0, 0];
    public uvScale: [number, number] = [1, 1];

    constructor(textureId: string) {
        super();
        this.textureId = textureId;
    }
}
