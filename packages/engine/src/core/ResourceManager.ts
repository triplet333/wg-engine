import { WebGPURenderer } from '../renderer/WebGPURenderer';
import { AudioManager } from './AudioManager';
import { TextureStore, ImageManifest } from './stores/TextureStore';
import { AudioStore, AudioManifest } from './stores/AudioStore';

export class ResourceManager {
    public readonly textures: TextureStore;
    public readonly audio: AudioStore;

    private renderer: WebGPURenderer;
    private audioManager: AudioManager;

    constructor(renderer: WebGPURenderer, audioManager: AudioManager) {
        this.renderer = renderer;
        this.audioManager = audioManager;
        this.textures = new TextureStore(renderer);
        this.audio = new AudioStore(audioManager.getContext());
    }

    public getRenderer(): WebGPURenderer {
        return this.renderer;
    }

    public getAudioManager(): AudioManager {
        return this.audioManager;
    }

    // Facade/Helper for unified loading
    public async loadManifest(manifest: { images?: ImageManifest, audio?: AudioManifest }): Promise<void> {
        const promises: Promise<void>[] = [];
        if (manifest.images) {
            promises.push(this.textures.loadManifest(manifest.images));
        }
        if (manifest.audio) {
            promises.push(this.audio.loadManifest(manifest.audio));
        }
        await Promise.all(promises);
    }
}
