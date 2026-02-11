import { WebGPURenderer } from '../renderer/WebGPURenderer';
import { AudioManager } from './AudioManager';
import { TextureStore, ImageManifest } from './stores/TextureStore';
import { AudioStore, AudioManifest } from './stores/AudioStore';
import { FontStore } from './stores/FontStore';

export type FontManifest = Record<string, { path: string }>;

export class ResourceManager {
    public readonly textures: TextureStore;
    public readonly audio: AudioStore;
    public readonly fonts: FontStore;

    private renderer: WebGPURenderer;
    private audioManager: AudioManager;

    constructor(renderer: WebGPURenderer, audioManager: AudioManager) {
        this.renderer = renderer;
        this.audioManager = audioManager;
        this.textures = new TextureStore(renderer);
        this.audio = new AudioStore(audioManager.getContext());
        this.fonts = new FontStore();
    }

    public getRenderer(): WebGPURenderer {
        return this.renderer;
    }

    public getAudioManager(): AudioManager {
        return this.audioManager;
    }

    // Facade/Helper for unified loading
    public async loadManifest(manifest: { images?: ImageManifest, audio?: AudioManifest, fonts?: FontManifest }): Promise<void> {
        const promises: Promise<void>[] = [];
        if (manifest.images) {
            promises.push(this.textures.loadManifest(manifest.images));
        }
        if (manifest.audio) {
            promises.push(this.audio.loadManifest(manifest.audio));
        }
        if (manifest.fonts) {
            const fontPromises = Object.entries(manifest.fonts).map(([family, config]) =>
                this.fonts.load(family, config.path)
            );
            promises.push(Promise.all(fontPromises).then(() => { }));
        }
        await Promise.all(promises);
    }
}
