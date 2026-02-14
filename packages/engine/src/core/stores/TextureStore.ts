import { WebGPURenderer } from '../../renderer/WebGPURenderer';
import { FontStore } from './FontStore';

export type ImageManifest = Record<string, { path: string }>;

export class TextureStore {
    private textures: Map<string, GPUTexture> = new Map();
    private loadingPromises: Map<string, Promise<GPUTexture>> = new Map();
    private renderer: WebGPURenderer;
    private fontStore: FontStore;

    constructor(renderer: WebGPURenderer, fontStore: FontStore) {
        this.renderer = renderer;
        this.fontStore = fontStore;
    }

    public async load(key: string, url: string): Promise<GPUTexture> {
        // Return existing texture if loaded
        if (this.textures.has(key)) {
            return this.textures.get(key)!;
        }

        // Return existing promise if loading
        if (this.loadingPromises.has(key)) {
            return this.loadingPromises.get(key)!;
        }

        // Start new load
        const promise = (async () => {
            try {
                const texture = await this.renderer.loadTexture(url);
                this.textures.set(key, texture);
                this.loadingPromises.delete(key); // Cleanup
                return texture;
            } catch (err) {
                this.loadingPromises.delete(key);
                throw err;
            }
        })();

        this.loadingPromises.set(key, promise);
        return promise;
    }

    public async loadManifest(manifest: ImageManifest): Promise<void> {
        const promises = Object.entries(manifest).map(async ([key, config]) => {
            await this.load(key, config.path);
        });
        await Promise.all(promises);
    }

    public get(key: string): GPUTexture | undefined {
        return this.textures.get(key);
    }

    public has(key: string): boolean {
        return this.textures.has(key);
    }

    public isLoading(key: string): boolean {
        return this.loadingPromises.has(key);
    }

    public updateTextTexture(key: string, text: {
        content: string,
        fontFamily: string,
        fontSize: number,
        color: string,
        width?: number,
        height?: number,
        align: 'left' | 'center' | 'right',
        lineHeight: number,
        shadow: { color: string, blur: number, offsetX: number, offsetY: number } | null,
        outline: { color: string, width: number } | null
    }): GPUTexture {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to get 2D context for text generation');
        ctx.imageSmoothingEnabled = false;

        // Check for Bitmap Font
        const bitmapFont = this.fontStore.getBitmapFont(text.fontFamily);
        if (bitmapFont && bitmapFont.texture) {
            // --- Bitmap Font Rendering ---
            const lines = text.content.split('\n');
            const lineHeight = bitmapFont.lineHeight; // Ignore text.lineHeight factor for BMFont usually, or multiply? 
            // Let's use font's lineHeight * text.lineHeight (multiplier)
            const finalLineHeight = Math.ceil(lineHeight * (text.lineHeight || 1));

            // Measure
            let maxWidth = 0;
            const lineWidths: number[] = [];

            // Helper to get glyph
            const getGlyph = (char: string) => {
                const code = char.charCodeAt(0);
                return bitmapFont.chars.get(code) || bitmapFont.chars.get(63); // 63 = '?' fallback?
            };

            for (const line of lines) {
                let width = 0;
                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    const glyph = getGlyph(char);
                    if (glyph) {
                        width += glyph.xadvance;
                        // Kerning could be here
                    }
                }
                if (width > maxWidth) maxWidth = width;
                lineWidths.push(width);
            }

            const totalHeight = lines.length * finalLineHeight;

            // Resize Canvas (No shadow/outline support for BMFont for now, or we can add it?)
            // If user wants shadow, we can draw twice? 
            // The prompt "ContiNeue2P" likely implies clean text.
            // Let's assume standard render for now.
            canvas.width = Math.max(1, maxWidth);
            canvas.height = Math.max(1, totalHeight);

            // Clear
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw
            // Handle Color Tinting? 
            // BMFonts are usually white. We can tint using `ctx.globalCompositeOperation = 'source-in'`?
            // Or just draw and hope user provided colored font?
            // "ContiNeue2P" png is likely white.
            // To tint: Draw text to offscreen, then fill rect with color using composite 'source-in', then draw to main?
            // Or just `ctx.fillStyle = color; ctx.fillRect... composite='destination-in'`?
            // Efficient way:
            // 1. Draw all glyphs.
            // 2. Composite color.

            let currentY = 0;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                let currentX = 0;

                // Align
                if (text.align === 'center') {
                    currentX = (canvas.width - lineWidths[i]) / 2;
                } else if (text.align === 'right') {
                    currentX = canvas.width - lineWidths[i];
                }

                for (let j = 0; j < line.length; j++) {
                    const char = line[j];
                    const glyph = getGlyph(char);
                    if (glyph) {
                        // Draw Glyph
                        // ctx.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
                        if (glyph.width > 0 && glyph.height > 0) {
                            ctx.drawImage(
                                bitmapFont.texture,
                                glyph.x, glyph.y, glyph.width, glyph.height,
                                currentX + glyph.xoffset, currentY + glyph.yoffset,
                                glyph.width, glyph.height
                            );
                        }
                        currentX += glyph.xadvance;
                    }
                }
                currentY += finalLineHeight;
            }

            // Tinting
            if (text.color && text.color !== '#FFFFFF') {
                ctx.globalCompositeOperation = 'source-in';
                ctx.fillStyle = text.color;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.globalCompositeOperation = 'source-over';
            }

            // Update Metrics
            if (typeof text.width === 'number') text.width = canvas.width;
            if (typeof text.height === 'number') text.height = canvas.height;

        } else {
            // --- Standard Canvas Text Rendering ---
            // Helper to parse rich text
            // Supported: <color=#RRGGBB>Text</color>
            type TextSegment = { text: string, color: string };
            const parseRichText = (str: string, defaultColor: string): TextSegment[] => {
                const segments: TextSegment[] = [];
                const regex = /<color=([^>]+)>(.*?)<\/color>|([^<]+)/g;
                let match;

                while ((match = regex.exec(str)) !== null) {
                    if (match[1]) {
                        // Color tag
                        segments.push({ text: match[2], color: match[1] });
                    } else if (match[3]) {
                        // Normal text
                        segments.push({ text: match[3], color: defaultColor });
                    }
                }
                if (segments.length === 0) segments.push({ text: str, color: defaultColor });
                return segments;
            };

            const lines = text.content.split('\n');
            const parsedLines = lines.map(line => parseRichText(line, text.color));

            const weight = 'normal';
            ctx.font = `${weight} ${text.fontSize}px ${text.fontFamily}`;

            // Measure
            let maxWidth = 0;
            const lineHeights: number[] = [];
            const lineSegments: { width: number, segments: TextSegment[] }[] = [];

            for (const line of parsedLines) {
                let lineWidth = 0;
                for (const seg of line) {
                    lineWidth += ctx.measureText(seg.text).width;
                }
                if (lineWidth > maxWidth) maxWidth = lineWidth;
                lineSegments.push({ width: lineWidth, segments: line });
                lineHeights.push(text.fontSize * text.lineHeight);
            }

            const totalHeight = lineHeights.reduce((a, b) => a + b, 0);

            // Resize Canvas
            // Add padding for shadow/outline
            const padding = Math.max(
                (text.shadow?.blur || 0) + Math.abs(text.shadow?.offsetX || 0),
                (text.outline?.width || 0)
            ) * 2 + 4; // +4 safety

            const canvasWidth = Math.ceil(maxWidth + padding * 2);
            const canvasHeight = Math.ceil(totalHeight + padding * 2);

            canvas.width = Math.max(1, canvasWidth);
            canvas.height = Math.max(1, canvasHeight);

            // Update Component Dimensions
            if (typeof text.width === 'number') text.width = canvas.width;
            if (typeof text.height === 'number') text.height = canvas.height;

            // Draw
            ctx.font = `${weight} ${text.fontSize}px ${text.fontFamily}`;
            ctx.textBaseline = 'top';
            ctx.textAlign = 'left';

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            let currentY = padding;

            for (let i = 0; i < lineSegments.length; i++) {
                const line = lineSegments[i];

                // Align X
                let currentX = padding;
                if (text.align === 'center') {
                    currentX = (canvas.width - line.width) / 2;
                } else if (text.align === 'right') {
                    currentX = canvas.width - padding - line.width;
                }

                // Draw Segments
                for (const seg of line.segments) {
                    ctx.fillStyle = seg.color;

                    // Shadow
                    if (text.shadow) {
                        ctx.shadowColor = text.shadow.color;
                        ctx.shadowBlur = text.shadow.blur;
                        ctx.shadowOffsetX = text.shadow.offsetX;
                        ctx.shadowOffsetY = text.shadow.offsetY;
                    } else {
                        ctx.shadowColor = 'transparent';
                    }

                    // Outline (Stroke)
                    if (text.outline) {
                        ctx.strokeStyle = text.outline.color;
                        ctx.lineWidth = text.outline.width * 2; // centered stroke
                        ctx.lineJoin = 'round'; // smoother corners
                        ctx.strokeText(seg.text, currentX, currentY);
                    }

                    // Fill
                    ctx.fillText(seg.text, currentX, currentY);

                    currentX += ctx.measureText(seg.text).width;
                }

                currentY += lineHeights[i];
            }
        }

        const texture = this.renderer.createTextureFromSource(canvas);
        this.textures.set(key, texture);
        return texture;
    }
}
