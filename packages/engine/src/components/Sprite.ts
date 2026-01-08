import { Component } from '../ecs/Component';

export class Sprite extends Component {
    // URL or ID of the texture
    public textureId: string;

    constructor(textureId: string) {
        super();
        this.textureId = textureId;
    }
}
