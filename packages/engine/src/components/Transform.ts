import { Component } from '../ecs/Component';

export class Transform extends Component {
    public x: number = 0;
    public y: number = 0;
    public z: number = 0; // Depth
    private _scale: [number, number] = [1, 1];

    constructor(x: number = 0, y: number = 0, z: number = 0) {
        super();
        this.x = x;
        this.y = y;
        this.z = z;
    }

    // Local Transform
    public rotation: number = 0; // Radians

    // Hierarchy
    public parent: Transform | null = null;
    public children: Transform[] = [];

    // World Transform Cache (Calculated by TransformSystem)
    public _worldX: number = 0;
    public _worldY: number = 0;
    public _worldZ: number = 0;
    public _worldRotation: number = 0;
    public _worldScaleX: number = 1;
    public _worldScaleY: number = 1;

    // Cache dirty flag? TransformSystem reconstructs every frame so maybe not needed yet.

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

    public addChild(child: Transform): void {
        child.parent = this;
        this.children.push(child);
    }

    public removeChild(child: Transform): void {
        const index = this.children.indexOf(child);
        if (index !== -1) {
            this.children.splice(index, 1);
            child.parent = null;
        }
    }
}
