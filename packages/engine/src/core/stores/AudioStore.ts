import { AudioGroup } from '../AudioManager';

export type AudioManifest = Record<string, { path: string, group: AudioGroup }>;

export class AudioStore {
    private assets: Map<string, { buffer: AudioBuffer, defaultGroup: AudioGroup }> = new Map();
    private loadingPromises: Map<string, Promise<{ buffer: AudioBuffer, defaultGroup: AudioGroup }>> = new Map();
    private context: AudioContext;

    constructor(context: AudioContext) {
        this.context = context;
    }

    public async load(key: string, url: string, group: AudioGroup): Promise<{ buffer: AudioBuffer, defaultGroup: AudioGroup }> {
        if (this.assets.has(key)) return this.assets.get(key)!;
        if (this.loadingPromises.has(key)) return this.loadingPromises.get(key)!;

        const promise = (async () => {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Failed to load audio: ${url} (Status: ${response.status})`);
                }
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
                const asset = { buffer: audioBuffer, defaultGroup: group };
                this.assets.set(key, asset);
                this.loadingPromises.delete(key);
                return asset;
            } catch (err) {
                this.loadingPromises.delete(key);
                throw err;
            }
        })();

        this.loadingPromises.set(key, promise);
        return promise;
    }

    public async loadManifest(manifest: AudioManifest): Promise<void> {
        const promises = Object.entries(manifest).map(([key, config]) =>
            this.load(key, config.path, config.group)
        );
        await Promise.all(promises);
    }

    public get(key: string): { buffer: AudioBuffer, defaultGroup: AudioGroup } | undefined {
        return this.assets.get(key);
    }

    public has(key: string): boolean {
        return this.assets.has(key);
    }

    public isLoading(key: string): boolean {
        return this.loadingPromises.has(key);
    }
}
