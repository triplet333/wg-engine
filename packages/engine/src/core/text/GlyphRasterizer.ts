
import { Path } from 'opentype.js';

export class GlyphRasterizer {
    /**
     * Rasterizes an OpenType path into a grayscale buffer.
     * Uses a simplified scanline algorithm with supersampling for anti-aliasing.
     * 
     * @param path The OpenType path to rasterize
     * @param size The font size
     * @param pixelRatio Display pixel ratio (for high-DPI)
     * @returns The rasterized glyph data
     */
    public static rasterize(path: Path, _fontSize: number): { data: Uint8Array, width: number, height: number, xoffset: number, yoffset: number } {
        const boundingBox = path.getBoundingBox();
        const xMin = Math.floor(boundingBox.x1);
        const yMin = Math.floor(boundingBox.y1);
        const xMax = Math.ceil(boundingBox.x2);
        const yMax = Math.ceil(boundingBox.y2);

        const width = xMax - xMin + 2; // +2 padding
        const height = yMax - yMin + 2;

        if (width <= 0 || height <= 0) {
            return { data: new Uint8Array(0), width: 0, height: 0, xoffset: 0, yoffset: 0 };
        }

        // Super-sampling factor (2x2 = 4 samples per pixel)
        const scale = 2;
        const ssWidth = width * scale;
        const ssHeight = height * scale;
        const buffer = new Uint8Array(ssWidth * ssHeight);

        // Flatten path to line segments
        const commands = path.commands;
        let startX = 0;
        let startY = 0;
        let currentX = 0;
        let currentY = 0;

        // Scanline Edge Table
        // For each Y (0..ssHeight), store list of intersection X and direction
        const edgeTable: { x: number, dir: number }[][] = new Array(ssHeight).fill(0).map(() => []);

        const addEdge = (p1x: number, p1y: number, p2x: number, p2y: number) => {
            // Adjust coordinates to simplified grid

            // path.toPathData() is usually SVG style.
            // When we use path.commands, y is usually standard Cartesian (up).
            // But we want to map into a buffer where index is (y * width + x).
            // Let's assume standard image text flow: we want top-down.
            // SVG font y grows DOWN? No, TrueType Y grows UP.
            // boundingBox.y1 is min, y2 is max.

            // To rasterize correctly into an image (0,0 is top-left), we need to flip Y.
            // Standard: text Y=0 is baseline.
            // min Y might be -10 (descender). max Y might be 50 (ascender).
            // We want (minX, maxY) to be (0,0) in our buffer? 
            // Usually we map (minX, minY) to (0, height) if we flip.

            // Let's stick to OpenType coordinate inputs.
            // We want the output image to be upright.
            // Image Y=0 is Top.
            // So Font MaxY should map to Image Y=0.

            // Map Function:
            // Revert to (yMax - p) * scale (Upright in texture)
            // Previous attempt to flip (p - yMin) result in "Flipped" text.
            // "Upside Down" report was likely due to artifacts or layout.
            // We stick to standard Upright texture generation.

            // Inverting logic to fix upside-down text
            // If the output is inverted, we switch to (p1y - yMin)
            let x1_ss = (p1x - xMin) * scale;
            let y1_ss = (p1y - yMin) * scale;
            let x2_ss = (p2x - xMin) * scale;
            let y2_ss = (p2y - yMin) * scale;

            const y1_ss_orig = y1_ss;
            const y2_ss_orig = y2_ss;

            // Ensure y1 < y2
            if (y1_ss > y2_ss) {
                [x1_ss, x2_ss] = [x2_ss, x1_ss];
                [y1_ss, y2_ss] = [y2_ss, y1_ss];
            }

            // Half-open interval logic for robust sampling at pixel centers (y + 0.5)
            const scanYStart = Math.ceil(y1_ss - 0.5);
            const scanYEnd = Math.ceil(y2_ss - 0.5);

            if (scanYStart >= scanYEnd) return;

            // Ignore horizontal lines to prevent division by zero
            if (y1_ss === y2_ss) return;

            // Determine direction (1 for down, -1 for up) based on original Y
            // Note: y1_ss and y2_ss were swapped, so we need to check original p1y vs p2y relative to yMin?
            // Actually, we swapped x1/y1 and x2/y2 if y1 > y2.
            // So y1 is ALWAYS <= y2 after swap.
            // But we need the winding direction of the ORIGINAL segment.
            // If original p1y < p2y (down), winding is +1?
            // Let's check swap condition.
            // If we swapped, it means original was Up (-1). If not swapped, Down (+1).
            const dyDir = (y1_ss_orig < y2_ss_orig) ? 1 : -1;

            const dx = (x2_ss - x1_ss) / (y2_ss - y1_ss);

            // Initial X at the first scanline intersection (y = scanYStart + 0.5)
            let curX = x1_ss + ((scanYStart + 0.5) - y1_ss) * dx;

            for (let y = scanYStart; y < scanYEnd; y++) {
                if (y >= 0 && y < ssHeight) {
                    edgeTable[y].push({ x: curX, dir: dyDir });
                }
                curX += dx;
            }
        };

        // Process Commands
        for (const cmd of commands) {
            switch (cmd.type) {
                case 'M':
                    startX = cmd.x;
                    startY = cmd.y;
                    currentX = cmd.x;
                    currentY = cmd.y;
                    break;
                case 'L':
                    addEdge(currentX, currentY, cmd.x, cmd.y);
                    currentX = cmd.x;
                    currentY = cmd.y;
                    break;
                case 'Q':
                    // Flatten Quad Bezier
                    // Simple recursive or fixed subdivision
                    {
                        const steps = 4; // Low quality for now
                        let dt = 1 / steps;
                        let t = 0;
                        let prevX = currentX;
                        let prevY = currentY;
                        for (let i = 1; i <= steps; i++) {
                            t += dt;
                            // Quad Formula: (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2
                            const invT = 1 - t;
                            const nextX = invT * invT * currentX + 2 * invT * t * cmd.x1 + t * t * cmd.x;
                            const nextY = invT * invT * currentY + 2 * invT * t * cmd.y1 + t * t * cmd.y;
                            addEdge(prevX, prevY, nextX, nextY);
                            prevX = nextX;
                            prevY = nextY;
                        }
                        currentX = cmd.x;
                        currentY = cmd.y;
                    }
                    break;
                case 'C':
                    // Flatten Cubic Bezier
                    {
                        const steps = 6;
                        let dt = 1 / steps;
                        let t = 0;
                        let prevX = currentX;
                        let prevY = currentY;
                        for (let i = 1; i <= steps; i++) {
                            t += dt;
                            const invT = 1 - t;
                            // Cubic: (1-t)^3 P0 + 3(1-t)^2 t P1 + 3(1-t) t^2 P2 + t^3 P3
                            const a = invT * invT * invT;
                            const b = 3 * invT * invT * t;
                            const c = 3 * invT * t * t;
                            const d = t * t * t;
                            const nextX = a * currentX + b * cmd.x1 + c * cmd.x2 + d * cmd.x;
                            const nextY = a * currentY + b * cmd.y1 + c * cmd.y2 + d * cmd.y;
                            addEdge(prevX, prevY, nextX, nextY);
                            prevX = nextX;
                            prevY = nextY;
                        }
                        currentX = cmd.x;
                        currentY = cmd.y;
                    }
                    break;
                case 'Z':
                    addEdge(currentX, currentY, startX, startY);
                    currentX = startX;
                    currentY = startY;
                    break;
            }
        }

        // Fill Buffer
        for (let y = 0; y < ssHeight; y++) {
            const rowEdges = edgeTable[y];
            rowEdges.sort((a, b) => a.x - b.x);

            // Non-Zero Winding Rule
            let winding = 0;
            for (let i = 0; i < rowEdges.length - 1; i++) {
                const edge = rowEdges[i];
                const nextEdge = rowEdges[i + 1];

                winding += edge.dir;

                if (winding !== 0) {
                    const start = Math.round(edge.x);
                    const end = Math.round(nextEdge.x);
                    for (let x = start; x < end; x++) {
                        if (x >= 0 && x < ssWidth) {
                            buffer[y * ssWidth + x] = 255;
                        }
                    }
                }
            }
        }

        // Downsample
        const output = new Uint8Array(width * height);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let sum = 0;
                for (let sy = 0; sy < scale; sy++) {
                    for (let sx = 0; sx < scale; sx++) {
                        const ssIndex = (y * scale + sy) * ssWidth + (x * scale + sx);
                        if (buffer[ssIndex]) sum++;
                    }
                }
                // Average
                output[y * width + x] = Math.round((sum / (scale * scale)) * 255);
            }
        }

        return {
            data: output,
            width,
            height,
            xoffset: xMin, // Usually metrics.xMin? No, we need offset to draw relative to 0,0
            yoffset: -yMin // Offset from return image (y=0) to baseline
            // Actually, usually we return Glyph Metrics (bearingX, etc).
            // Here we just return the bitmap and where it should be placed relative to origin.
            // Image Top-Left corresponds to (xMin, yMax) in Font Space.
        };
    }
}
