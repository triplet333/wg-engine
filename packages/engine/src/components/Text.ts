import { Component } from '../ecs/Component';

export class Text extends Component {
    public content: string;
    public fontFamily: string;
    public fontSize: number;
    public color: string;
    public isDirty: boolean = true;
    public _textureId: string | null = null; // Internal cache ID
    public width: number = 0;
    public height: number = 0;

    constructor(content: string = '', style: { fontFamily?: string, fontSize?: number, color?: string } = {}) {
        super();
        this.content = content;
        this.fontFamily = style.fontFamily || 'sans-serif';
        this.fontSize = style.fontSize || 24;
        this.color = style.color || 'white';
    }

    public update(content: string) {
        if (this.content !== content) {
            this.content = content;
            this.isDirty = true;
        }
    }
}
