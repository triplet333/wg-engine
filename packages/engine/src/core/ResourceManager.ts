import { WebGPURenderer } from '../renderer/WebGPURenderer';
import { AudioManager } from './AudioManager';
import { TextureStore, ImageManifest } from './stores/TextureStore';
import { AudioStore, AudioManifest } from './stores/AudioStore';
import { FontStore } from './stores/FontStore';
import { FontManager } from './text/FontManager';
import { GlyphAtlas } from './text/GlyphAtlas';

export type FontManifest = Record<string, { path: string }>;
export type BitmapFontManifest = Record<string, { fnt: string, texture: string }>;

export class ResourceManager {
    public readonly textures: TextureStore;
    public readonly audio: AudioStore;
    public readonly fonts: FontStore;
    public readonly fontManager: FontManager;
    public readonly glyphAtlas: GlyphAtlas;

    private renderer: WebGPURenderer;
    private audioManager: AudioManager;

    constructor(renderer: WebGPURenderer, audioManager: AudioManager) {
        this.renderer = renderer;
        this.audioManager = audioManager;
        this.fonts = new FontStore();
        this.textures = new TextureStore(renderer, this.fonts);
        this.audio = new AudioStore(audioManager.getContext());
        this.fontManager = new FontManager();
        this.glyphAtlas = new GlyphAtlas(renderer);
    }

    public getRenderer(): WebGPURenderer {
        return this.renderer;
    }

    public getAudioManager(): AudioManager {
        return this.audioManager;
    }

    // Facade/Helper for unified loading
    public async loadManifest(manifest: {
        images?: ImageManifest,
        audio?: AudioManifest,
        fonts?: FontManifest,
        bitmapFonts?: BitmapFontManifest,
        openTypeFonts?: FontManifest // reusing FontManifest {path: string}
    }): Promise<void> {
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
        if (manifest.bitmapFonts) {
            const fontPromises = Object.entries(manifest.bitmapFonts).map(([family, config]) =>
                this.fonts.loadBitmapFont(family, config.fnt, config.texture)
            );
            promises.push(Promise.all(fontPromises).then(() => { }));
        }
        if (manifest.openTypeFonts) {
            const fontPromises = Object.entries(manifest.openTypeFonts).map(([family, config]) =>
                this.fontManager.loadFont(family, config.path)
            );
            promises.push(Promise.all(fontPromises).then(() => { }));
        }
        await Promise.all(promises);
    }
}
