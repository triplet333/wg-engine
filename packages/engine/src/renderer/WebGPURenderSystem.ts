
import { System } from '../ecs/System';
import { IWorld } from '../ecs/types';
import { WebGPURenderer } from './WebGPURenderer';
import { Transform } from '../components/Transform';
import { Renderable } from '../components/Renderable';
import { Sprite } from '../components/Sprite';
import { ResourceManager } from '../core/ResourceManager';
import { Camera } from '../components/Camera';
import { Text } from '../components/Text';
import { Layer } from '../components/Layer';
// @ts-ignore
import quadShader from './shaders/quad.wgsl';

export class WebGPURenderSystem extends System {
    private renderer: WebGPURenderer;
    private resourceManager: ResourceManager;

    private pipeline: GPURenderPipeline | null = null;

    // Dynamic Batch Buffers
    private maxVertices = 65536; // 16k quads
    private maxIndices = 65536 * 6; // 
    private vertexBuffer: GPUBuffer | null = null;
    private indexBuffer: GPUBuffer | null = null;

    private vertexData: Float32Array; // Pos(2) + UV(2) + Color(4) = 8 floats
    private indexData: Uint16Array;
    private vertexCount = 0;
    private indexCount = 0;

    private viewBindGroupLayout: GPUBindGroupLayout | null = null;
    private materialBindGroupLayout: GPUBindGroupLayout | null = null;

    private isReady: boolean = false;
    private world!: IWorld;

    // 1x1 White Texture for pure colored renderables
    private whiteTexture: GPUTexture | null = null;

    constructor(renderer: WebGPURenderer, resourceManager: ResourceManager) {
        super();
        this.renderer = renderer;
        this.resourceManager = resourceManager;
        this.priority = 1000;

        // Init CPU buffers
        this.vertexData = new Float32Array(this.maxVertices * 8);
        this.indexData = new Uint16Array(this.maxIndices);
    }

    public init(world: IWorld): void {
        this.world = world;
        this.initializeResources();
    }

    private async initializeResources(): Promise<void> {
        if (!this.renderer.device) return;

        // 1. Create Shader Module
        const shaderModule = this.renderer.device.createShaderModule({
            code: quadShader,
        });

        // 2. Create Dynamic Buffers
        this.vertexBuffer = this.renderer.device.createBuffer({
            size: this.vertexData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        this.indexBuffer = this.renderer.device.createBuffer({
            size: this.indexData.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        });

        // 3. Create White Texture
        this.whiteTexture = this.renderer.device.createTexture({
            size: [1, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });
        this.renderer.device.queue.writeTexture(
            { texture: this.whiteTexture },
            new Uint8Array([255, 255, 255, 255]),
            { bytesPerRow: 4, rowsPerImage: 1 },
            { width: 1, height: 1 }
        );


        // 4. Create Bind Group Layouts
        this.viewBindGroupLayout = this.renderer.device.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: { type: 'uniform' } // Dynamic offset not needed if we re-create bg/buffer per cam
            }]
        });

        this.materialBindGroupLayout = this.renderer.device.createBindGroupLayout({
            entries: [
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
                { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} }
            ]
        });

        // 5. Create Pipeline
        const pipelineLayout = this.renderer.device.createPipelineLayout({
            bindGroupLayouts: [this.viewBindGroupLayout, this.materialBindGroupLayout],
        });

        this.pipeline = this.renderer.device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_main',
                buffers: [
                    {
                        arrayStride: 8 * 4, // 8 floats
                        stepMode: 'vertex',
                        attributes: [
                            { shaderLocation: 0, offset: 0, format: 'float32x2' }, // Position
                            { shaderLocation: 1, offset: 2 * 4, format: 'float32x2' }, // UV
                            { shaderLocation: 2, offset: 4 * 4, format: 'float32x4' }, // Color
                        ],
                    }
                ],
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_main',
                targets: [
                    {
                        format: this.renderer.format,
                        blend: {
                            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                        },
                    },
                ],
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'none',
            },
        });

        this.isReady = true;
        console.log("WebGPURenderSystem initialized (Dynamic Batch Mode)");
    }

    public async update(_dt: number): Promise<void> {
        const width = this.renderer.canvas.width;
        const height = this.renderer.canvas.height;
        if (width === 0 || height === 0 || !this.isReady) return;

        // 1. Collect Cameras
        const cameras = this.world.query(Camera).map(e => ({
            entity: e,
            camera: this.world.getComponent(e, Camera)!
        })).sort((a, b) => a.camera.priority - b.camera.priority);

        if (cameras.length === 0) return;

        let cameraIndex = 0;
        if (!this.renderer.context) return;
        const textureView = this.renderer.context.getCurrentTexture().createView();

        const textureStore = this.resourceManager.textures;

        for (const camObj of cameras) {
            const camera = camObj.camera;
            const camTransform = this.world.getComponent(camObj.entity, Transform);
            if (!camTransform) continue;

            // Setup Viewport & Uniforms (Same as before)
            const destRect = this.calcRect(camera.rect, width, height);
            let projW = this.renderer.virtualWidth || width;
            let projH = this.renderer.virtualHeight || height;

            if (camera.viewport) {
                const source = this.calcRect(camera.viewport, this.renderer.virtualWidth || width, this.renderer.virtualHeight || height);
                projW = source.w;
                projH = source.h;
            } else {
                if (this.renderer.virtualWidth && this.renderer.virtualHeight) {
                    projW = this.renderer.virtualWidth / camera.zoom;
                    projH = this.renderer.virtualHeight / camera.zoom;
                } else {
                    projW = destRect.w / camera.zoom;
                    projH = destRect.h / camera.zoom;
                }
            }

            // Create Uniform Buffer
            const uniforms = new Float32Array([
                projW, projH,
                camTransform.x, camTransform.y,
                camera.zoom, 0.0, 0.0, 0.0 // Padding included in vec4 alignment usually
            ]);

            const uniformBuffer = this.renderer.device!.createBuffer({
                size: 32,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                mappedAtCreation: true
            });
            new Float32Array(uniformBuffer.getMappedRange()).set(uniforms);
            uniformBuffer.unmap();

            const viewBindGroup = this.renderer.device!.createBindGroup({
                layout: this.viewBindGroupLayout!,
                entries: [{ binding: 0, resource: { buffer: uniformBuffer } }]
            });

            // 2. Collect Renderables in Layers
            const renderList: { entity: any, texture: GPUTexture | null, sortKey: string }[] = [];
            const allTransforms = this.world.query(Transform);

            for (const ent of allTransforms) {
                const layer = this.world.getComponent(ent, Layer);
                const layerName = layer ? layer.name : 'Default';
                if (!camera.layers.includes(layerName)) continue;

                // Check visibility
                const renderable = this.world.getComponent(ent, Renderable);
                // Currently only objects with Renderable or Sprite or Text are drawn?
                // Old logic: only if Sprite or Text or Renderable.

                const sprite = this.world.getComponent(ent, Sprite);
                const text = this.world.getComponent(ent, Text);

                let tex: GPUTexture | null = null;
                let sortKey = '';

                if (sprite) {
                    if (sprite.textureId && !textureStore.has(sprite.textureId) && !textureStore.isLoading(sprite.textureId)) {
                        textureStore.load(sprite.textureId, sprite.textureId).catch(console.error);
                    }
                    tex = sprite.textureId ? textureStore.get(sprite.textureId) || null : null;
                    if (tex) sortKey = sprite.textureId;
                } else if (text) {
                    // Two modes: Bitmap/Canvas Font (Legacy) OR OpenType Font (New)
                    // Check FontManager
                    // For now, simpler logic:
                    if (this.resourceManager.fontManager.getFont(text.fontFamily)) {
                        // OpenType Mode
                        const font = this.resourceManager.fontManager.getFont(text.fontFamily)!;
                        // Generate Mesh if needed
                        if (!text.mesh || text.isDirty) {
                            this.generateTextMesh(text, font);
                        }
                        if (text.mesh) {
                            tex = text.mesh.texture; // Atlas
                            sortKey = 'Atlas'; // Or Atlas ID
                        }
                    } else {
                        // Legacy Mode
                        if (text.isDirty || !text._textureId) {
                            text._textureId = `text_${ent}`;
                            textureStore.updateTextTexture(text._textureId, text);
                            text.isDirty = false;
                        }
                        if (text._textureId) {
                            tex = textureStore.get(text._textureId) || null;
                            sortKey = text._textureId;
                        }
                    }
                } else if (renderable) {
                    // Colored box
                    tex = this.whiteTexture;
                    sortKey = '__WHITE__';
                }

                if (tex) {
                    renderList.push({ entity: ent, texture: tex, sortKey });
                }
            }

            renderList.sort((a, b) => {
                const ta = this.world.getComponent(a.entity, Transform)!;
                const tb = this.world.getComponent(b.entity, Transform)!;

                // 1. Z Order (Ascending: 0 drawn first, 10 drawn over 0)
                if (ta._worldZ !== tb._worldZ) {
                    return ta._worldZ - tb._worldZ;
                }

                // 2. Texture Batching
                return a.sortKey.localeCompare(b.sortKey);
            });

            // 3. Batching & Filling Buffers
            this.vertexCount = 0;
            this.indexCount = 0;
            const batches: { texture: GPUTexture, indexCount: number, startIndex: number }[] = [];
            let currentBatch: { texture: GPUTexture, indexCount: number, startIndex: number } | null = null;

            for (const item of renderList) {
                const transform = this.world.getComponent(item.entity, Transform)!;
                const renderable = this.world.getComponent(item.entity, Renderable);

                // Apply Alpha/Color
                let r = 1, g = 1, b = 1, a = 1;
                if (renderable) {
                    if (!renderable.visible) continue;
                    r = renderable.color[0]; g = renderable.color[1]; b = renderable.color[2]; a = renderable.color[3];
                }

                // Check Batch
                if (!currentBatch || currentBatch.texture !== item.texture) {
                    if (currentBatch) batches.push(currentBatch);
                    currentBatch = { texture: item.texture!, indexCount: 0, startIndex: this.indexCount };
                }

                // Generate Quads
                // Need World Matrix logic (Pos, Scale, Rot)
                // Or separate transform logic per vertex

                const text = this.world.getComponent(item.entity, Text);
                const sprite = this.world.getComponent(item.entity, Sprite);

                if (text && text.mesh && this.resourceManager.fontManager.getFont(text.fontFamily)) {
                    // OpenType Mesh
                    const mesh = text.mesh;
                    const vStart = this.vertexCount; // Index offset for this mesh

                    // Transform each vertex
                    // Optim: Matrix mult in JS
                    const m00 = Math.cos(transform._worldRotation) * transform._worldScaleX;
                    const m01 = Math.sin(transform._worldRotation) * transform._worldScaleX;
                    const m10 = -Math.sin(transform._worldRotation) * transform._worldScaleY;
                    const m11 = Math.cos(transform._worldRotation) * transform._worldScaleY;
                    const tx = transform._worldX;
                    const ty = transform._worldY;

                    // Append Vertices
                    for (let i = 0; i < mesh.vertices.length; i += 4) { // stride 4 [x,y,u,v] in mesh?
                        // define mesh format: x,y,u,v
                        const vx = mesh.vertices[i];
                        const vy = mesh.vertices[i + 1];
                        const vu = mesh.vertices[i + 2];
                        const vv = mesh.vertices[i + 3];

                        const wx = vx * m00 + vy * m10 + tx;
                        const wy = vx * m01 + vy * m11 + ty;

                        const offset = this.vertexCount * 8;
                        this.vertexData[offset] = wx;
                        this.vertexData[offset + 1] = wy;
                        this.vertexData[offset + 2] = vu;
                        this.vertexData[offset + 3] = vv;
                        this.vertexData[offset + 4] = r;
                        this.vertexData[offset + 5] = g;
                        this.vertexData[offset + 6] = b;
                        this.vertexData[offset + 7] = a;

                        this.vertexCount++;
                    }

                    // Append Indices
                    for (let i = 0; i < mesh.indices.length; i++) {
                        this.indexData[this.indexCount++] = vStart + mesh.indices[i];
                    }

                    currentBatch!.indexCount += mesh.indices.length;

                } else {
                    // Sprite, Legacy Text, or Colored Box (Single Quad)
                    // const w = 1.0;
                    // const h = 1.0;
                    let anchorX = 0, anchorY = 0;
                    let uvX = 0, uvY = 0, uvW = 1, uvH = 1;
                    let widthPx = 50, heightPx = 50; // default

                    if (sprite) {
                        anchorX = sprite.anchor[0];
                        anchorY = sprite.anchor[1];
                        uvX = sprite.uvOffset[0];
                        uvY = sprite.uvOffset[1];
                        uvW = sprite.uvScale[0];
                        uvH = sprite.uvScale[1];

                        const tex = item.texture;
                        if (tex) { widthPx = tex.width; heightPx = tex.height; }
                    } else if (text) { // Legacy
                        if (text.align === 'center') anchorX = 0.5;
                        else if (text.align === 'right') anchorX = 1.0;
                        anchorY = 0.5; // Center Y default
                        if (text.width > 0) widthPx = text.width;
                        if (text.height > 0) heightPx = text.height;
                    } // Else Box: anchor 0, size 50 (from transform scale usually)

                    // Local Quad (0..1) -> Scaled by size -> Offset by anchor -> Scaled by Transform -> Rotated -> Translated
                    // Vertices: (0,0), (0,1), (1,1), (1,0)

                    // Compute 4 corners
                    const corners = [
                        { x: 0, y: 0, u: 0, v: 0 },
                        { x: 0, y: 1, u: 0, v: 1 },
                        { x: 1, y: 1, u: 1, v: 1 },
                        { x: 1, y: 0, u: 1, v: 0 }
                    ];

                    const vStart = this.vertexCount;

                    const m00 = Math.cos(transform._worldRotation) * transform._worldScaleX;
                    const m01 = Math.sin(transform._worldRotation) * transform._worldScaleX;
                    const m10 = -Math.sin(transform._worldRotation) * transform._worldScaleY;
                    const m11 = Math.cos(transform._worldRotation) * transform._worldScaleY;
                    const tx = transform._worldX;
                    const ty = transform._worldY;

                    // For sprites, we multiply size by texture dimensions?
                    // Previous shader: `texW * sprite.uvScale[0] * transform._worldScaleX`
                    // Here `widthPx` is texture size. `transform` has scale.
                    // So we map 0..1 to 0..widthPx.

                    const realW = widthPx * uvW;
                    const realH = heightPx * uvH;

                    for (const c of corners) {
                        // 1. To Pixels (Unscaled)
                        let lx = (c.x - anchorX) * realW;
                        let ly = (c.y - anchorY) * realH;

                        // 2. World Transform
                        const wx = lx * m00 + ly * m10 + tx; // Note: m00 includes ScaleX. 

                        const wy = lx * m01 + ly * m11 + ty;

                        // const u = uvX + c.u * uvW;
                        // UV: `baseUV * uvScale + uvOffset`. 
                        // c.u is 0 or 1.
                        const vu = (c.u * uvW) + uvX; // Yes.
                        const vv = (c.v * uvH) + uvY;

                        const offset = this.vertexCount * 8;
                        this.vertexData[offset] = wx;
                        this.vertexData[offset + 1] = wy;
                        this.vertexData[offset + 2] = vu;
                        this.vertexData[offset + 3] = vv;
                        this.vertexData[offset + 4] = r;
                        this.vertexData[offset + 5] = g;
                        this.vertexData[offset + 6] = b;
                        this.vertexData[offset + 7] = a;

                        this.vertexCount++;
                    }

                    // Indices (0,1,2, 0,2,3)
                    this.indexData[this.indexCount++] = vStart + 0;
                    this.indexData[this.indexCount++] = vStart + 1;
                    this.indexData[this.indexCount++] = vStart + 2;
                    this.indexData[this.indexCount++] = vStart + 0;
                    this.indexData[this.indexCount++] = vStart + 2;
                    this.indexData[this.indexCount++] = vStart + 3;

                    currentBatch!.indexCount += 6;
                }
            }
            if (currentBatch) batches.push(currentBatch);


            // 4. Render
            if (this.vertexCount > 0 && this.vertexBuffer && this.indexBuffer) {
                this.renderer.device!.queue.writeBuffer(this.vertexBuffer, 0, this.vertexData as any, 0, this.vertexCount * 8 * 4);
                // Indices
                this.renderer.device!.queue.writeBuffer(this.indexBuffer, 0, this.indexData as any, 0, this.indexCount * 2);

                const commandEncoder = this.renderer.device!.createCommandEncoder();

                const shouldClear = (cameraIndex === 0 && camera.clearColor);

                const passEncoder = commandEncoder.beginRenderPass({
                    colorAttachments: [{
                        view: textureView,
                        clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
                        loadOp: shouldClear ? 'clear' : 'load',
                        storeOp: 'store',
                    }]
                });

                passEncoder.setViewport(destRect.x, destRect.y, destRect.w, destRect.h, 0, 1);
                passEncoder.setScissorRect(destRect.x, destRect.y, destRect.w, destRect.h);

                passEncoder.setPipeline(this.pipeline!);
                passEncoder.setBindGroup(0, viewBindGroup);
                passEncoder.setVertexBuffer(0, this.vertexBuffer);
                passEncoder.setIndexBuffer(this.indexBuffer, 'uint16');

                const filterMode: GPUFilterMode = this.renderer.pixelArt ? 'nearest' : 'linear';
                const sampler = this.renderer.device!.createSampler({ magFilter: filterMode, minFilter: filterMode });

                for (const batch of batches) {
                    const materialGroup = this.renderer.device!.createBindGroup({
                        layout: this.materialBindGroupLayout!,
                        entries: [
                            { binding: 1, resource: sampler },
                            { binding: 2, resource: batch.texture.createView() }
                        ]
                    });
                    passEncoder.setBindGroup(1, materialGroup);
                    passEncoder.drawIndexed(batch.indexCount, 1, batch.startIndex, 0, 0);
                }

                passEncoder.end();
                this.renderer.device!.queue.submit([commandEncoder.finish()]);
            }
            cameraIndex++;
        }
    }

    private calcRect(r: { x: number, y: number, w: number, h: number, unit: 'ratio' | 'pixel' }, refW: number, refH: number) {
        if (r.unit === 'ratio') {
            return {
                x: Math.floor(r.x * refW),
                y: Math.floor(r.y * refH),
                w: Math.floor(r.w * refW),
                h: Math.floor(r.h * refH)
            };
        } else {
            return { x: r.x, y: r.y, w: r.w, h: r.h };
        }
    };

    private generateTextMesh(text: Text, font: any) {
        const str = text.content;
        const fontSize = text.fontSize || 24;

        // Measure first to determine alignment offsets
        const lines = str.split('\n');
        const layout: { char: string, x: number, y: number, w: number, h: number, u0: number, v0: number, u1: number, v1: number }[] = [];

        let cursorY = 0;
        const lineHeight = fontSize * (text.lineHeight || 1.2);

        let maxWidth = 0;

        for (const line of lines) {
            let cursorX = 0;
            let prevChar = null;
            const lineQuads = [];
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                // Get Glyph
                const glyph = this.resourceManager.glyphAtlas.getGlyph(font, text.fontFamily, char, fontSize);

                // Add Quad
                // x = cursorX + (bearingX? included in xadvance maybe? No, GlyphAtlas currently just returns width/height/xadvance)
                // xoffset logic in GlyphAtlas?
                // atlas.xoffset is x bearing.
                // atlas.yoffset is distance from baseline to top.

                // Kerning
                if (prevChar) {
                    const leftGlyph = font.charToGlyph(prevChar);
                    const rightGlyph = font.charToGlyph(char);
                    const scale = fontSize / font.unitsPerEm;
                    const kerning = font.getKerningValue(leftGlyph, rightGlyph) * scale;
                    cursorX += kerning;
                }

                if (glyph.width > 0 && glyph.height > 0) {
                    lineQuads.push({
                        char,
                        x: Math.round(cursorX + glyph.xoffset),
                        y: Math.round(cursorY - glyph.yoffset), // Y is DOWN. Baseline is cursorY. Top is Y - yoffset.
                        w: glyph.width,
                        h: glyph.height,
                        u0: glyph.u0,
                        v0: glyph.v0,
                        u1: glyph.u1,
                        v1: glyph.v1
                    });
                }
                cursorX += glyph.xadvance;
                prevChar = char;
            }

            // Align Line
            if (cursorX > maxWidth) maxWidth = cursorX;

            // Just store lineQuads temporarily for alignment?
            // Actually push to layout with "Line Width" info for alignment later?
            // Or apply alignment now.

            // To apply alignment we need to know the full width of *this* line (cursorX).
            const lineWidth = cursorX;
            let alignOffset = 0;
            if (text.align === 'center') alignOffset = -lineWidth / 2;
            else if (text.align === 'right') alignOffset = -lineWidth;

            for (const q of lineQuads) {
                q.x += alignOffset;
                layout.push(q);
            }

            cursorY += lineHeight;
        }

        text.width = maxWidth;
        text.height = cursorY; // Approx

        // Generate Arrays
        const numQuads = layout.length;
        const vertices = new Float32Array(numQuads * 4 * 4); // 4 verts * 4 floats (x,y,u,v)
        const indices = new Uint16Array(numQuads * 6);

        for (let i = 0; i < numQuads; i++) {
            const q = layout[i];
            const vBase = i * 4 * 4;
            const iBase = i * 6;
            const idxBase = i * 4;

            // Verts TL, BL, BR, TR
            // TL
            vertices[vBase + 0] = q.x;
            vertices[vBase + 1] = q.y;
            vertices[vBase + 2] = q.u0;
            vertices[vBase + 3] = q.v0;

            // BL
            vertices[vBase + 4] = q.x;
            vertices[vBase + 5] = q.y + q.h;
            vertices[vBase + 6] = q.u0;
            vertices[vBase + 7] = q.v1;

            // BR
            vertices[vBase + 8] = q.x + q.w;
            vertices[vBase + 9] = q.y + q.h;
            vertices[vBase + 10] = q.u1;
            vertices[vBase + 11] = q.v1;

            // TR
            vertices[vBase + 12] = q.x + q.w;
            vertices[vBase + 13] = q.y;
            vertices[vBase + 14] = q.u1;
            vertices[vBase + 15] = q.v0;

            // Indices
            indices[iBase + 0] = idxBase + 0;
            indices[iBase + 1] = idxBase + 1;
            indices[iBase + 2] = idxBase + 2;
            indices[iBase + 3] = idxBase + 0;
            indices[iBase + 4] = idxBase + 2;
            indices[iBase + 5] = idxBase + 3;
        }

        text.mesh = {
            vertices,
            indices,
            texture: this.resourceManager.glyphAtlas.texture
        };
        text.isDirty = false;
    }
}
