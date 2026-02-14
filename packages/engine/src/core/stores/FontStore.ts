import { BitmapFont } from '../ui/BitmapFont';

export class FontStore {
    private fonts: Map<string, FontFace> = new Map();
    private bitmapFonts: Map<string, BitmapFont> = new Map();

    /**
     * Loads a font face from a URL.
     * @param family The font family name.
     * @param url The URL to the font file.
     * @param descriptors Optional font descriptors.
     */
    public async load(family: string, url: string, descriptors?: FontFaceDescriptors): Promise<void> {
        if (this.fonts.has(family)) {
            return;
        }

        console.log(`Loading font: ${family} from ${url}`);
        const fontFace = new FontFace(family, `url(${url})`, descriptors);

        try {
            await fontFace.load();
            document.fonts.add(fontFace);
            this.fonts.set(family, fontFace);
            console.log(`Font loaded: ${family}`);
        } catch (err) {
            console.error(`Failed to load font: ${family}`, err);
            throw err;
        }
    }

    /**
     * Loads a bitmap font from .fnt and texture URL.
     * @param family The font family name to register.
     * @param fntUrl The URL to the .fnt file.
     * @param textureUrl The URL to the texture file.
     */
    public async loadBitmapFont(family: string, fntUrl: string, textureUrl: string): Promise<void> {
        if (this.bitmapFonts.has(family)) return;

        console.log(`Loading bitmap font: ${family} from ${fntUrl}`);
        try {
            const response = await fetch(fntUrl);
            const text = await response.text();

            const font = new BitmapFont(text);

            // Load Texture
            // We assume simple single page for now or explicit textureUrl override
            // font.pages might contain relative path, but here we enforce textureUrl for simplicity
            // or we use the directory of fntUrl + page file.
            // Let's use the provided textureUrl.

            const imgResp = await fetch(textureUrl);
            const blob = await imgResp.blob();
            font.texture = await createImageBitmap(blob);

            this.bitmapFonts.set(family, font);
            console.log(`Bitmap Font loaded: ${family}`);
        } catch (err) {
            console.error(`Failed to load bitmap font: ${family}`, err);
            throw err;
        }
    }

    public has(family: string): boolean {
        return this.fonts.has(family) || this.bitmapFonts.has(family);
    }

    public getBitmapFont(family: string): BitmapFont | undefined {
        return this.bitmapFonts.get(family);
    }
}
