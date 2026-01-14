import { Component } from '../ecs/Component';
import { Sprite } from './Sprite';

export class SpriteSheet extends Component {
    public rows: number;
    public columns: number;

    constructor(rows: number, columns: number) {
        super();
        this.rows = rows;
        this.columns = columns;
    }

    public setFrame(sprite: Sprite, frameIndex: number): void {
        if (frameIndex < 0 || frameIndex >= this.rows * this.columns) {
            console.warn(`Frame index ${frameIndex} out of bounds for SpriteSheet (${this.rows}x${this.columns})`);
            return;
        }

        const col = frameIndex % this.columns;
        const row = Math.floor(frameIndex / this.columns);

        // Calculate UV scale (1 / count)
        const uScale = 1.0 / this.columns;
        const vScale = 1.0 / this.rows;

        // Calculate UV offset (col * scale, row * scale)
        const uOffset = col * uScale;
        const vOffset = row * vScale;

        sprite.uvScale = [uScale, vScale];
        sprite.uvOffset = [uOffset, vOffset];
    }
}
