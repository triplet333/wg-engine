
import { WebGPURenderer } from '../../renderer/WebGPURenderer';
import { Font } from 'opentype.js';
import { GlyphRasterizer } from './GlyphRasterizer';

interface GlyphInfo {
    u0: number;
    v0: number;
    u1: number;
    v1: number;
    width: number;
    height: number;
    xoffset: number;
    yoffset: number; // Offset from baseline to top of glyph
    xadvance: number;
}

export class GlyphAtlas {
    private renderer: WebGPURenderer;
    public texture: GPUTexture;
    public width: number = 2048;
    public height: number = 2048;
    private padding: number = 2; // Increase padding to avoid bleeding

    private cursorX: number = 0;
    private cursorY: number = 0;
    private maxHeightInRow: number = 0;

    // Cache: "Family:Size:Char" -> GlyphInfo
    private glyphCache: Map<string, GlyphInfo> = new Map();

    constructor(renderer: WebGPURenderer) {
        this.renderer = renderer;
        if (!renderer.device) {
            throw new Error("WebGPURenderer device not initialized");
        }
        this.texture = renderer.device.createTexture({
            size: [this.width, this.height, 1],
            format: 'rgba8unorm', // RGBA for easy blending with sprite shader
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        });
    }

    public getGlyph(font: Font, family: string, char: string, fontSize: number): GlyphInfo {
        const key = `${family}:${fontSize}:${char}`;
        if (this.glyphCache.has(key)) {
            return this.glyphCache.get(key)!;
        }

        return this.addGlyph(font, key, char, fontSize);
    }

    private addGlyph(font: Font, key: string, char: string, fontSize: number): GlyphInfo {
        const glyph = font.charToGlyph(char);
        const path = glyph.getPath(0, 0, fontSize);
        const raster = GlyphRasterizer.rasterize(path, fontSize); // This returns image data with flipped Y logic handled?
        // GlyphRasterizer returns data where input path (opentype) had Y UP.
        // And we mapped it such that output image is Top-Down.
        // yoffset returned is "Font Space Max Y" which corresponds to Image Top.
        // So when drawing: 
        // ScreenY = BaselineY - yoffset (Because Font MaxY is UP from baseline).

        // Wait, GlyphRasterizer returns `yoffset = yMax` (of the bounding box).
        // If we want to draw at (bx, by) which is the baseline origin.
        // The image top-left should be at (bx + xoffset, by - yoffset).
        // Since Y is down in screen space.

        // Example: 'A'. yMax = 50. yMin = 0.
        // Image is 50px high.
        // We draw at (baseline) - 50.
        // Correct.

        // Packing Logic (Simple Shelf)
        if (this.cursorX + raster.width > this.width) {
            this.cursorX = 0;
            this.cursorY += this.maxHeightInRow + this.padding;
            this.maxHeightInRow = 0;
        }

        if (this.cursorY + raster.height > this.height) {
            console.warn("Glyph Atlas Full!");
            // return empty or fallback?
            return { u0: 0, v0: 0, u1: 0, v1: 0, width: 0, height: 0, xoffset: 0, yoffset: 0, xadvance: 0 };
        }

        // Upload
        if (raster.width > 0 && raster.height > 0) {
            // Convert R8 to RGBA8 (Tight packing)
            const rgbaData = new Uint8Array(raster.width * raster.height * 4);

            for (let i = 0; i < raster.width * raster.height; i++) {
                const alpha = raster.data[i];
                rgbaData[i * 4 + 0] = 255;
                rgbaData[i * 4 + 1] = 255;
                rgbaData[i * 4 + 2] = 255;
                rgbaData[i * 4 + 3] = alpha;
            }

            this.renderer.device!.queue.writeTexture(
                { texture: this.texture, origin: [this.cursorX, this.cursorY, 0] },
                rgbaData,
                { bytesPerRow: raster.width * 4, rowsPerImage: raster.height },
                { width: raster.width, height: raster.height }
            );
        }

        const info: GlyphInfo = {
            u0: this.cursorX / this.width,
            v0: this.cursorY / this.height,
            u1: (this.cursorX + raster.width) / this.width,
            v1: (this.cursorY + raster.height) / this.height,
            width: raster.width,
            height: raster.height,
            xoffset: raster.xoffset,
            yoffset: raster.yoffset,
            xadvance: (glyph.advanceWidth || 0) * (fontSize / font.unitsPerEm) // Scale advance width
        };

        this.glyphCache.set(key, info);

        this.cursorX += raster.width + this.padding;
        if (raster.height > this.maxHeightInRow) this.maxHeightInRow = raster.height;

        return info;
    }
}
