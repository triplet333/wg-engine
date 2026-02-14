import { Component } from '../ecs/Component';

export class Text extends Component {
    public content: string;
    public fontFamily: string;
    public fontSize: number;
    public color: string;
    public align: 'left' | 'center' | 'right';
    public lineHeight: number;
    public shadow: { color: string, blur: number, offsetX: number, offsetY: number } | null;
    public outline: { color: string, width: number } | null;
    public isDirty: boolean = true;
    public _textureId: string | null = null; // Internal cache ID
    public width: number = 0;
    public height: number = 0;
    public mesh: { vertices: Float32Array, indices: Uint16Array, texture: GPUTexture } | null = null; // OpenType Cache

    constructor(
        content: string = '',
        style: {
            fontFamily?: string,
            fontSize?: number,
            color?: string,
            align?: 'left' | 'center' | 'right',
            lineHeight?: number,
            shadow?: { color: string, blur: number, offsetX: number, offsetY: number },
            outline?: { color: string, width: number }
        } = {}
    ) {
        super();
        this.content = content;
        this.fontFamily = style.fontFamily || 'sans-serif';
        this.fontSize = style.fontSize || 24;
        this.color = style.color || 'white';
        this.align = style.align || 'left';
        this.lineHeight = style.lineHeight || 1.2;
        this.shadow = style.shadow || null;
        this.outline = style.outline || null;
    }

    public update(content: string, style?: {
        fontFamily?: string,
        fontSize?: number,
        color?: string,
        align?: 'left' | 'center' | 'right',
        lineHeight?: number,
        shadow?: { color: string, blur: number, offsetX: number, offsetY: number },
        outline?: { color: string, width: number }
    }) {
        if (this.content !== content) {
            this.content = content;
            this.isDirty = true;
        }
        if (style) {
            if (style.fontFamily !== undefined && this.fontFamily !== style.fontFamily) { this.fontFamily = style.fontFamily; this.isDirty = true; }
            if (style.fontSize !== undefined && this.fontSize !== style.fontSize) { this.fontSize = style.fontSize; this.isDirty = true; }
            if (style.color !== undefined && this.color !== style.color) { this.color = style.color; this.isDirty = true; }
            if (style.align !== undefined && this.align !== style.align) { this.align = style.align; this.isDirty = true; }
            if (style.lineHeight !== undefined && this.lineHeight !== style.lineHeight) { this.lineHeight = style.lineHeight; this.isDirty = true; }
            if (style.shadow !== undefined) { this.shadow = style.shadow; this.isDirty = true; }
            if (style.outline !== undefined) { this.outline = style.outline; this.isDirty = true; }
        }
    }
}
