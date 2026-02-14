
import { load, Font } from 'opentype.js';

export class FontManager {
    private fonts: Map<string, Font> = new Map();
    private loadingPromises: Map<string, Promise<Font>> = new Map();

    public async loadFont(family: string, url: string): Promise<Font> {
        if (this.fonts.has(family)) {
            return this.fonts.get(family)!;
        }

        if (this.loadingPromises.has(family)) {
            return this.loadingPromises.get(family)!;
        }

        const promise = new Promise<Font>((resolve, reject) => {
            load(url, (err, font) => {
                if (err) {
                    reject(err);
                } else {
                    if (font) {
                        this.fonts.set(family, font);
                        this.loadingPromises.delete(family);
                        resolve(font);
                    } else {
                        reject(new Error(`Failed to load font from ${url}`));
                    }
                }
            });
        });

        this.loadingPromises.set(family, promise);
        return promise;
    }

    public getFont(family: string): Font | undefined {
        return this.fonts.get(family);
    }
}
