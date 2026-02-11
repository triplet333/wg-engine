export class FontStore {
    private fonts: Map<string, FontFace> = new Map();

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

    public has(family: string): boolean {
        return this.fonts.has(family);
    }
}
