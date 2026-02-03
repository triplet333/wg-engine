import { WebGPURenderer } from '../renderer/WebGPURenderer';
import { AudioGroup } from './AudioManager';

export type AudioManifest = Record<string, { path: string, group: AudioGroup }>;
export type ImageManifest = Record<string, { path: string }>;

export class ResourceManager {
    private textures: Map<string, GPUTexture> = new Map();
    private loadingPromises: Map<string, Promise<GPUTexture>> = new Map();
    private renderer: WebGPURenderer;

    constructor(renderer: WebGPURenderer) {
        this.renderer = renderer;
    }

    public getRenderer(): WebGPURenderer {
        return this.renderer;
    }

    public async loadTexture(url: string): Promise<GPUTexture> {
        // Return existing texture if loaded
        if (this.textures.has(url)) {
            return this.textures.get(url)!;
        }

        // Return existing promise if loading
        if (this.loadingPromises.has(url)) {
            return this.loadingPromises.get(url)!;
        }

        // Start new load
        const promise = (async () => {
            try {
                const texture = await this.renderer.loadTexture(url);
                this.textures.set(url, texture);
                this.loadingPromises.delete(url); // Cleanup
                return texture;
            } catch (err) {
                this.loadingPromises.delete(url);
                throw err;
            }
        })();

        this.loadingPromises.set(url, promise);
        return promise;
    }

    public async loadTextureManifest(manifest: ImageManifest): Promise<void> {
        const promises = Object.entries(manifest).map(async ([key, config]) => {
            const texture = await this.loadTexture(config.path);
            // Register alias for Key access
            this.textures.set(key, texture);
        });
        await Promise.all(promises);
    }



    // --- AUDIO ---
    public readonly audioAssets: Map<string, { buffer: AudioBuffer, defaultGroup: AudioGroup }> = new Map();
    private audioLoadingPromises: Map<string, Promise<{ buffer: AudioBuffer, defaultGroup: AudioGroup }>> = new Map();

    public async loadAudio(key: string, url: string, group: AudioGroup, context: AudioContext): Promise<{ buffer: AudioBuffer, defaultGroup: AudioGroup }> {
        if (this.audioAssets.has(key)) return this.audioAssets.get(key)!;
        if (this.audioLoadingPromises.has(key)) return this.audioLoadingPromises.get(key)!;

        const promise = (async () => {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Failed to load audio: ${url} (Status: ${response.status})`);
                }
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await context.decodeAudioData(arrayBuffer);
                const asset = { buffer: audioBuffer, defaultGroup: group };
                this.audioAssets.set(key, asset);
                this.audioLoadingPromises.delete(key);
                return asset;
            } catch (err) {
                this.audioLoadingPromises.delete(key);
                throw err;
            }
        })();

        this.audioLoadingPromises.set(key, promise);
        return promise;
    }

    public async loadAudioManifest(manifest: AudioManifest, context: AudioContext): Promise<void> {
        const promises = Object.entries(manifest).map(([key, config]) =>
            this.loadAudio(key, config.path, config.group, context)
        );
        await Promise.all(promises);
    }

    public getAudio(key: string): { buffer: AudioBuffer, defaultGroup: AudioGroup } | undefined {
        return this.audioAssets.get(key);
    }

    public getTexture(url: string): GPUTexture | undefined {
        return this.textures.get(url);
    }

    public hasTexture(url: string): boolean {
        return this.textures.has(url);
    }

    public updateTextTexture(key: string, text: { content: string, fontFamily: string, fontSize: number, color: string, width?: number, height?: number }): GPUTexture {
        // Create an offscreen canvas for text
        // (In a real engine, we might reuse a single canvas to avoid allocations)
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to get 2D context for text generation');

        // Measure text
        const weight = 'normal'; // Could be made configurable
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

        // Upload to GPU
        // If texture already exists for this key, we could destroy it or overwrite it.
        // For simplicity, we create a new one and let GC (or manual cleanup) handle the old one if we were properly managing lifecycle.
        // But here we overwrite the map entry.

        const texture = this.renderer.createTextureFromSource(canvas);
        this.textures.set(key, texture);
        return texture;
    }

    public isLoading(url: string): boolean {
        return this.loadingPromises.has(url);
    }
}
