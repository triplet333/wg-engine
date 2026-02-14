export interface BitmapFontGlyph {
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    xoffset: number;
    yoffset: number;
    xadvance: number;
    page: number;
}

export class BitmapFont {
    public family!: string;
    public size!: number;
    public lineHeight!: number;
    public base!: number;
    public scaleW!: number;
    public scaleH!: number;
    public pages: string[] = [];
    public chars: Map<number, BitmapFontGlyph> = new Map();
    public texture: ImageBitmap | null = null; // Currently support single page

    constructor(data: string) {
        this.parse(data);
    }

    private parse(data: string) {
        const lines = data.split(/\r?\n/);

        for (const line of lines) {
            if (line.startsWith('info')) {
                this.family = this.getValue(line, 'face');
                this.size = parseInt(this.getValue(line, 'size'));
            } else if (line.startsWith('common')) {
                this.lineHeight = parseInt(this.getValue(line, 'lineHeight'));
                this.base = parseInt(this.getValue(line, 'base'));
                this.scaleW = parseInt(this.getValue(line, 'scaleW'));
                this.scaleH = parseInt(this.getValue(line, 'scaleH'));
            } else if (line.startsWith('page')) {
                const id = parseInt(this.getValue(line, 'id'));
                const file = this.getValue(line, 'file');
                this.pages[id] = file;
            } else if (line.startsWith('char ')) { // Note space to avoid matching 'chars'
                const glyph: BitmapFontGlyph = {
                    id: parseInt(this.getValue(line, 'id')),
                    x: parseInt(this.getValue(line, 'x')),
                    y: parseInt(this.getValue(line, 'y')),
                    width: parseInt(this.getValue(line, 'width')),
                    height: parseInt(this.getValue(line, 'height')),
                    xoffset: parseInt(this.getValue(line, 'xoffset')),
                    yoffset: parseInt(this.getValue(line, 'yoffset')),
                    xadvance: parseInt(this.getValue(line, 'xadvance')),
                    page: parseInt(this.getValue(line, 'page'))
                };
                this.chars.set(glyph.id, glyph);
            }
        }
    }

    private getValue(line: string, key: string): string {
        // Regex to match key=value or key="value"
        const regex = new RegExp(`${key}=(?:\\"([^\\"]*)\\"|([^\\s]*))`);
        const match = line.match(regex);
        if (match) {
            return match[1] || match[2];
        }
        return '';
    }
}
