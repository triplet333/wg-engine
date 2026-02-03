import { Component } from '../ecs/Component';

export type RectUnit = 'ratio' | 'pixel';

export interface CameraRect {
    x: number;
    y: number;
    w: number;
    h: number;
    unit: RectUnit;
}

export class Camera extends Component {
    public zoom: number = 1.0;
    public isMain: boolean = false; // Deprecated conceptually, but kept for compatibility if needed, or mapped to priority?
    // We can say isMain=true sets priority=0, layers=['Default', 'UI'] etc? 
    // Let's keep isMain for now but rely on priority for sorting.

    public priority: number = 0;
    public layers: string[] = ['Default'];
    public clearColor: boolean = true;
    public pixelPerfect: boolean = false;

    // Destination Rect (Where on screen)
    public rect: CameraRect = { x: 0, y: 0, w: 1, h: 1, unit: 'ratio' };

    // Source Rect (What part of world) - null means auto-calculated from Zoom + Aspect Ratio
    public viewport: CameraRect | null = null;

    constructor(zoom: number = 1.0, isMain: boolean = false) {
        super();
        this.zoom = zoom;
        this.isMain = isMain;

        // Default configs based on isMain?
        if (isMain) {
            this.priority = 0;
            this.layers = ['Default']; // Maybe add UI?
        }
    }
}
