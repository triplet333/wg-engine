import { Component } from '../ecs/Component';

export class BoxCollider extends Component {
    public width: number;
    public height: number;
    public offsetX: number = 0;
    public offsetY: number = 0;
    public isTrigger: boolean;
    public isStatic: boolean;

    /**
     * @param width Width of the collider
     * @param height Height of the collider
     * @param isStatic If true, this object will not be pushed by physics (e.g. walls).
     * @param isTrigger If true, this object detects collisions but passes through (e.g. powerups).
     */
    constructor(width: number = 0, height: number = 0, isStatic: boolean = false, isTrigger: boolean = false) {
        super();
        this.width = width;
        this.height = height;
        this.isStatic = isStatic;
        this.isTrigger = isTrigger;
    }
}
