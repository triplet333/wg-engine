import { Component } from '../ecs/Component';

export class Camera extends Component {
    public zoom: number = 1.0;
    public isMain: boolean = false;

    constructor(zoom: number = 1.0, isMain: boolean = false) {
        super();
        this.zoom = zoom;
        this.isMain = isMain;
    }
}
