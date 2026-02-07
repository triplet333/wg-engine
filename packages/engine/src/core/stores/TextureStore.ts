import { WebGPURenderer } from '../../renderer/WebGPURenderer';

export type ImageManifest = Record<string, { path: string }>;

export class TextureStore {
    private textures: Map<string, GPUTexture> = new Map();
    private loadingPromises: Map<string, Promise<GPUTexture>> = new Map();
    private renderer: WebGPURenderer;

    constructor(renderer: WebGPURenderer) {
        this.renderer = renderer;
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

    public updateTextTexture(key: string, text: { content: string, fontFamily: string, fontSize: number, color: string, width?: number, height?: number }): GPUTexture {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to get 2D context for text generation');

        // Measure text
        const weight = 'normal';
        ctx.font = `${weight} ${text.fontSize}px ${text.fontFamily}`;
        const metrics = ctx.measureText(text.content);

        // Resize canvas (add a moderate padding to avoid clipping)
        const width = Math.ceil(metrics.width);
        const height = Math.ceil(text.fontSize * 1.2); // Rough estimation
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);

        // Store dimensions back to text component if possible
        if (typeof text.width === 'number') text.width = canvas.width;
        if (typeof text.height === 'number') text.height = canvas.height;

        // Draw text
        ctx.font = `${weight} ${text.fontSize}px ${text.fontFamily}`;
        ctx.fillStyle = text.color;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.clearRect(0, 0, width, height);
        ctx.fillText(text.content, 0, 0);

        const texture = this.renderer.createTextureFromSource(canvas);
        this.textures.set(key, texture);
        return texture;
    }
}
