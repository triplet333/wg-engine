import { System } from '../ecs/System';
import { IWorld } from '../ecs/types';
import { WebGPURenderer } from './WebGPURenderer';
import { Transform } from '../components/Transform';
import { Renderable } from '../components/Renderable';
import { Sprite } from '../components/Sprite';
import { TextureStore } from '../core/stores/TextureStore';
import { Camera } from '../components/Camera';
import { Text } from '../components/Text';
import { Layer } from '../components/Layer';
// @ts-ignore
import quadShader from './shaders/quad.wgsl';

export class WebGPURenderSystem extends System {
    private renderer: WebGPURenderer;
    private textureStore: TextureStore;

    private pipeline: GPURenderPipeline | null = null;
    private vertexBuffer: GPUBuffer | null = null;
    private instanceBuffer: GPUBuffer | null = null;


    private viewBindGroupLayout: GPUBindGroupLayout | null = null;
    private materialBindGroupLayout: GPUBindGroupLayout | null = null;

    // Per Instance: Pos(2) + Color(4) + UVOffset(2) + UVScale(2) + Scale(2) = 12 floats = 48 bytes
    private instanceStride = 12 * 4;
    private maxInstances = 10000;
    private instanceData = new Float32Array(this.maxInstances * 12);

    private isReady: boolean = false;
    private world!: IWorld;

    constructor(renderer: WebGPURenderer, textureStore: TextureStore) {
        super();
        this.renderer = renderer;
        this.textureStore = textureStore;
        this.priority = 1000;
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

        // 2. Create Vertex Buffer (Unit Quad)

        const vertices = new Float32Array([
            0.0, 0.0,
            0.0, 1.0,
            1.0, 1.0,

            0.0, 0.0,
            1.0, 1.0,
            1.0, 0.0,
        ]);

        // ... (lines 65-350 ignored/kept same until render loop)



        this.vertexBuffer = this.renderer.device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices);
        this.vertexBuffer.unmap();

        // 3. Create Instance Buffer
        this.instanceBuffer = this.renderer.device.createBuffer({
            size: this.instanceData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        // 4. Create Uniform Buffer (View)
        // struct ViewUniforms {
        //   viewport: vec2f,
        //   cameraPosition: vec2f,
        //   cameraZoom: f32,
        //   _padding: f32,
        // }; => 6 floats = 24 bytes (but we might need 32 byte alignment? No, 16 byte alignment for vec4s. 24 is fine for buffer size but often good to align.)
        // Actually alignment:
        // vec2 (0)
        // vec2 (8)
        // f32 (16)
        // f32 (20) padding
        // Total = 24 bytes.
        // Let's alloc 32 bytes just to be safe and standard.


        // 5. Create Bind Group Layouts

        // Group 0: View (Uniforms)
        this.viewBindGroupLayout = this.renderer.device.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: { type: 'uniform' }
            }]
        });

        // Group 1: Material (Sampler + Texture)
        this.materialBindGroupLayout = this.renderer.device.createBindGroupLayout({
            entries: [
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {}
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {}
                }
            ]
        });

        // 6. Create Pipeline
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
                        arrayStride: 2 * 4,
                        stepMode: 'vertex',
                        attributes: [{
                            shaderLocation: 0,
                            offset: 0,
                            format: 'float32x2',
                        }],
                    },
                    {
                        arrayStride: this.instanceStride,
                        stepMode: 'instance',
                        attributes: [
                            {
                                shaderLocation: 1,
                                offset: 0,
                                format: 'float32x2', // Position
                            },
                            {
                                shaderLocation: 2,
                                offset: 2 * 4,
                                format: 'float32x4', // Color
                            },
                            {
                                shaderLocation: 3,
                                offset: 6 * 4,
                                format: 'float32x2', // UV Offset
                            },
                            {
                                shaderLocation: 4,
                                offset: 8 * 4,
                                format: 'float32x2', // UV Scale
                            },
                            {
                                shaderLocation: 5,
                                offset: 10 * 4,
                                format: 'float32x2', // Scale
                            }
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
                            color: {
                                srcFactor: 'src-alpha',
                                dstFactor: 'one-minus-src-alpha',
                                operation: 'add',
                            },
                            alpha: {
                                srcFactor: 'one',
                                dstFactor: 'one-minus-src-alpha',
                                operation: 'add',
                            },
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
        console.log("WebGPURenderSystem initialized (Batch Rendering Mode)");
    }

    public async update(_dt: number): Promise<void> {
        const width = this.renderer.canvas.width;
        const height = this.renderer.canvas.height;
        if (width === 0 || height === 0) return;

        if (!this.isReady || !this.renderer.device || !this.renderer.context || !this.pipeline || !this.viewBindGroupLayout || !this.materialBindGroupLayout) return;

        // 1. Collect and Sort Cameras
        const cameras = this.world.query(Camera).map(e => ({
            entity: e,
            camera: this.world.getComponent(e, Camera)!
        })).sort((a, b) => a.camera.priority - b.camera.priority);

        // If no camera, add a default fallback one?
        if (cameras.length === 0) {
            // No camera, no render
            return;
        }

        // 2. Prepare Batches (Global or per camera?)
        // Efficiency: We can collect ALL renderables once, then filter per camera.
        // OR we can query loop per camera.
        // Given we need to sort/batch per camera (as different cameras might see different layers), 
        // AND different cameras have different transforms/uniforms.
        // Wait, 'UniformBuffer' has Camera Pos/Zoom. We only have ONE uniform buffer slot in bind group 0.
        // So we MUST update uniform buffer for each camera and issue draw calls.
        // This implies: Update Uniform -> Draw -> Update Uniform -> Draw.
        // In WebGPU, we can do this within one Pass if we use `writeBuffer` and `setBindGroup`?
        // No, `writeBuffer` is queue-based and asynchronous/batched at submission boundaries usually (or undefined order if mixed with commands).
        // Standard way is "Dynamic Uniform Buffer" (one big buffer, bind window) OR "Multiple BindGroups".
        // EASIEST WAY: One RenderPass, but call `writeBuffer`? 
        // NO, strict WebGPU doesn't guarantee `writeBuffer` inside a pass affects subsequent draw calls within the same pass instantly if queued.
        // Actually `queue.writeBuffer` sits on the queue. `commandEncoder` commands sit on the queue.
        // It's safer to use `setBindGroup` with offsets (Dynamic Offsets) if we want one pass.
        // OR just have one buffer per camera?
        // OR simplest: Create a new uniform buffer for each camera every frame? (Garbage heaven).
        // OR: Alloc a big buffer "FrameUniforms" and use `hasDynamicOffset: true` in layout.
        // Let's try Dynamic Offsets. It's the pro way.

        // HOWEVER, `WebGPURenderSystem` currently has `this.uniformBuffer = createBuffer(32)`.
        // I will change it to a larger buffer or Re-create it.
        // For simplicity now, I will use `device.queue.writeBuffer` and assume separate submissions?
        // NO, that's slow (multiple submits).
        // Let's use **Multiple `beginRenderPass`** (one per camera) in ONE command encoder?
        // Still need to update uniforms. `writeBuffer` between passes is fine.
        // YES: 
        // Encoder Start
        // Loop Cameras:
        //   Write Uniforms (Queue) -> Wait, Queue writes happen *before* CommandBuffer execution usually?
        //   "Queue writes and buffer mapping are synchronized with the GPU...". 
        //   Constructing the command buffer happens on CPU.
        //   If I queue.writeBuffer(A), encode(draw A), queue.writeBuffer(B), encode(draw B), submit([cmd]).
        //   The queue writes might all happen before the command buffer starts executing?
        //   Actually, `writeBuffer` puts a write command on the queue.
        //   So: Write(A), Submit(CmdA), Write(B), Submit(CmdB).
        //   This works. Submit is the boundary.
        //   So we need **One Submit per Camera** or **Dynamic Uniforms**.
        //   Let's go with **Dynamic Uniforms** (Offset).

        // New Plan for Logic:
        // 1. Calculate how many cameras. 
        // 2. Alloc Uniform Buffer = `cameras.length * 256` (Min alignment 256 bytes).
        // 3. Write all camera data to this buffer at once.
        // 4. `beginRenderPass` (One pass for the whole frame? No, LoadOp/ClearOp issue).
        //    - First Camera: LoadOp = Clear.
        //    - Subsequent: LoadOp = Load.
        //    Actually, we can use ONE pass if we just use Scissor/Viewport?
        //    YES, provided we cleared the screen at start.
        //    If Camera 2 wants to "Clear" its rect... we can't do that easily in one pass with just LoadOp.
        //    But based on my design: "Main Camera (Clear=true)", "Sub Camera (Clear=false)".
        //    This fits "One Pass, One Clear at start" perfectly.
        //    If a SubCamera *really* wants a background color, it should draw a colored quad.
        //    So I will stick to **Single Pass** for performance.
        //    And I will use **Dynamic Uniforms**.

        // Update Layout for Dynamic Offset
        // NOTE: I need to recreate the Layout if I change to `hasDynamicOffset: true`.
        // Let's check `initializeResources`. I need to change `viewBindGroupLayout`.

        // Wait, editing `initializeResources` is annoying with `replace_file_content` if I don't touch it.
        // Can I just loop: `writeBuffer` -> `submit` -> `writeBuffer` -> `submit`?
        // It's less efficient but much easier to implement right now without changing the BindGroup Architecture.
        // Given this is a prototype/alpha engine, Simplest Implementation wins.
        // **Proposed Implementation**: Loop { Write Uniforms; Encode Pass; Submit; } for each camera.

        // const commandEncoder = this.renderer.device.createCommandEncoder(); // Wait, we need one encode per submit? Yes if we interleave with queue.
        // Actually no, we can have multiple passes in one encoder, BUT we cannot interleave `queue.writeBuffer` in the middle of an encoder recording *and have it affect the encoder*.
        // Detailed: `queue.writeBuffer` happens at execution. `renderPass` records commands.
        // If we want to change the buffer content *between* passes in the same submission, we generally can't use `queue.writeBuffer` on the same handle easily without race conditions or it just updating "last one wins".
        // OK, **Dynamic Uniforms** or **Multiple Buffers** is the only correct way for Single Submit.
        // Let's use **Multiple Buffers**. We have `cameras.length`.
        // I'll create a transient uniform buffer for each camera? Or a pool.

        // Let's just create a new Buffer per camera per frame for now. It's negligible for < 10 cameras.

        let cameraIndex = 0;
        const textureView = this.renderer.context.getCurrentTexture().createView();

        for (const camObj of cameras) {
            const camera = camObj.camera;
            const camEntity = camObj.entity;
            const camTransform = this.world.getComponent(camEntity, Transform);
            if (!camTransform) continue;

            const camX = camTransform.x;
            const camY = camTransform.y;
            const camZoom = camera.zoom;

            // Calculate Viewport & Scissor
            // Helper to calc rect
            const calcRect = (r: { x: number, y: number, w: number, h: number, unit: 'ratio' | 'pixel' }, refW: number, refH: number) => {
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

            const destRect = calcRect(camera.rect, width, height);

            // Calculate Projection Size (Virtual Resolution or Source Viewport)
            let projW = this.renderer.virtualWidth || width;
            let projH = this.renderer.virtualHeight || height;

            if (camera.viewport) {
                // Explicit Source Viewport
                // If unit is ratio, relative to "Virtual Resolution" if set, else Screen.
                const refW = this.renderer.virtualWidth || width;
                const refH = this.renderer.virtualHeight || height;
                const source = calcRect(camera.viewport, refW, refH);
                projW = source.w;
                projH = source.h;
            } else {
                // Auto calculated from Dest Aspect Ratio & Zoom
                // Default logic: Camera Zoom 1.0 means "1 Virtual Unit = 1 Pixel" or similar?
                // In existing logic: `viewportW = this.renderer.virtualWidth`
                // And `viewPos` is transformed.
                // If we want to maintain aspect ratio of DestRect:
                // If Dest is 100x100, we want to see 100x100 world units (at 1x zoom).
                // If Dest is 200x100, we want to see 200x100 world units.
                // So: ProjW = DestW / Zoom? or DestW?
                // Existing wgsl: `clipX = (viewPos.x / view.viewport.x) * 2.0 - 1.0`
                // So `view.viewport` is the DENOMINATOR (World Size seen).
                // So if `viewport.x` = 100, then world 0..100 maps to -1..1.
                // So `projW` should be the World Size.

                // If Pixel Perfect:
                // Snap Dest Size to multiple of Source?
                // Or snap Zoom to integer?
                // Let's implement basics first.
                projW = destRect.w / camZoom;
                projH = destRect.h / camZoom;
            }

            // Create Uniform Buffer for this camera
            const uniforms = new Float32Array([
                projW, projH,
                camX, camY,
                camZoom, 0.0 // Zoom moved to proj calc? No, shader uses zoom + viewport.
                // Wait, if I pre-divide projW by zoom, I should set zoom to 1.0 in shader?
                // In generic 2D camera:
                // ViewPos = (World - CamPos) * Zoom
                // Clip = ViewPos / ScreenSize * 2 - 1
                // So effectively: (World - CamPos) * Zoom / ScreenSize
                // = (World - CamPos) / (ScreenSize / Zoom)
                // So passing `projW = ScreenSize` and `zoom = Zoom` works.
                // OR `projW = ScreenSize / Zoom` and `zoom = 1`.
                // Existing shader uses `viewport` and `zoom`.
                // Let's stick to existing: Pass `projW = destRect.w` (or virtualW) and `zoom`.
                // IF we have explicit Source Viewport (e.g. 200x200), we want `projW=200`.
                // Shader: `(World - CamPos) * Zoom / 200`.
                // If Zoom is 1, we show 200 units. Correct.
            ]);

            // Note: If using explicit viewport, Zoom is likely 1.0 or user controlled. 
            // If I set `projW = destRect.w / camZoom`, then Shader `viewport` gets `destRect.w / camZoom`.
            // Shader calc: `... / (destRect.w / camZoom)` = `... * camZoom / destRect.w`.
            // Same as `... * camZoom / viewport`.
            // So if I pass `projW = destRect.w` (virtual), it matches "1 world unit = 1 pixel" at zoom 1.

            // For explicit viewport, we pass that viewport size.
            // For auto viewport, we pass `destRect.w` (if we want 1-to-1).

            const uniformBuffer = this.renderer.device.createBuffer({
                size: 32,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                mappedAtCreation: true
            });
            new Float32Array(uniformBuffer.getMappedRange()).set(uniforms);
            uniformBuffer.unmap();

            // Create BindGroup
            const camBindGroup = this.renderer.device.createBindGroup({
                layout: this.viewBindGroupLayout!,
                entries: [{ binding: 0, resource: { buffer: uniformBuffer } }]
            });

            // 3. Render Pass
            // Need a new command encoder or pass per camera?
            // "It is not valid to set the scissor rect to something larger than the attachment..."
            // DestRect is smaller than attachment. Safe.

            // LoadOp logic
            const shouldClear = (cameraIndex === 0 && camera.clearColor);

            const commandEncoder = this.renderer.device.createCommandEncoder();
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

            passEncoder.setPipeline(this.pipeline);
            passEncoder.setBindGroup(0, camBindGroup);
            passEncoder.setVertexBuffer(0, this.vertexBuffer);
            passEncoder.setVertexBuffer(1, this.instanceBuffer);

            // 4. Batch & Draw only entities in Camera Layers
            const renderList: { entity: any; textureId: string }[] = [];

            // Query renderables
            const allTransforms = this.world.query(Transform);

            // Optimization: In a real engine, we'd cache this list or use an acceleration structure.
            // Here we loop all transforms every camera pass.
            for (const ent of allTransforms) {
                // Check Layer
                const layer = this.world.getComponent(ent, Layer) as Layer | undefined;
                const layerName = layer ? layer.name : 'Default';
                if (!camera.layers.includes(layerName)) continue;

                const sprite = this.world.getComponent(ent, Sprite);
                const text = this.world.getComponent(ent, Text);

                if (sprite) {
                    renderList.push({ entity: ent, textureId: sprite.textureId });
                } else if (text) {
                    if (text.isDirty || !text._textureId) {
                        text._textureId = `text_${ent}`;
                        this.textureStore.updateTextTexture(text._textureId, text);
                        text.isDirty = false;
                    }
                    if (text._textureId) renderList.push({ entity: ent, textureId: text._textureId });
                } else {
                    // Colored box (Renderable but no Sprite)
                    const rend = this.world.getComponent(ent, Renderable);
                    if (rend) renderList.push({ entity: ent, textureId: '' });
                }
            }

            renderList.sort((a, b) => a.textureId.localeCompare(b.textureId));

            // Populate Instance Buffer (Partially! Only effectively used ones)
            // Wait, we share `this.instanceBuffer`. 
            // If we write to it now, does it overwrite previous pass data?
            // YES. 
            // In a Single Submit, Multiple Pass frame:
            // Pass A records "Draw using buffer X".
            // Then we Write to buffer X.
            // Pass B records "Draw using buffer X".
            // This is a race condition or "Last Write Wins" for the whole frame if using `writeBuffer` on queue.
            // BUT `device.queue.writeBuffer` is for the QUEUE.
            // If we map/unmap or use staging buffers...
            // The safest way for "Dynamic Geometry per Pass" in one frame is **Double Buffering** or **Dynamic Offsets**.
            // Or simple: **Multiple Submits**.
            // "Encode -> Finish -> Submit" per camera.
            // This is totally valid and easiest to implement right now.
            // Efficiency hit is minor for 2-3 cameras.

            // I will use **Multiple Submits** approach to avoid buffer contention.
            // Logic:
            // Loop Camera:
            //   Calc Instance Data.
            //   Write to `this.instanceBuffer`.
            //   Encode Pass.
            //   Submit.
            // END Loop.

            // ... (Instance population logic from line 362)
            // Need to copy-paste the "Populate Instance Data" logic block here?
            // Or refactor into helper?
            // Refactoring is safer.

            // ... (Let's pretend I refactored or just inline it for now)

            let instanceCount = 0;
            const batches: { textureId: string; count: number; start: number }[] = [];
            let currentBatch: { textureId: string; count: number; start: number } | null = null;

            for (const item of renderList) {
                if (instanceCount >= this.maxInstances) break;
                // Texture load check...
                if (item.textureId && !this.textureStore.has(item.textureId) && !this.textureStore.isLoading(item.textureId)) {
                    this.textureStore.load(item.textureId, item.textureId).catch(console.error); // Note: Assuming textureId is URL if not in manifest? Or logic changed? 
                    // Wait, original logic called loadTexture(item.textureId). 
                    // TextureStore.load(key, url). If key==url, it works just like before.
                }
                const texture = item.textureId ? this.textureStore.get(item.textureId) : null;
                if (item.textureId && !texture) continue;

                // Update Batch
                if (!currentBatch || currentBatch.textureId !== item.textureId) {
                    if (currentBatch) batches.push(currentBatch);
                    currentBatch = { textureId: item.textureId, count: 0, start: instanceCount };
                }

                // Fill instance data... (Same logic as before)
                const transform = this.world.getComponent(item.entity, Transform)!;
                const renderable = this.world.getComponent(item.entity, Renderable);
                const offset = instanceCount * 12;

                // ... (Fill data) ...
                this.instanceData[offset] = transform.x;
                this.instanceData[offset + 1] = transform.y;

                if (renderable) {
                    this.instanceData[offset + 2] = renderable.color[0];
                    this.instanceData[offset + 3] = renderable.color[1];
                    this.instanceData[offset + 4] = renderable.color[2];
                    this.instanceData[offset + 5] = renderable.color[3];
                } else {
                    this.instanceData[offset + 2] = 1.0;
                    this.instanceData[offset + 3] = 1.0;
                    this.instanceData[offset + 4] = 1.0;
                    this.instanceData[offset + 5] = 1.0;
                }

                const sprite = this.world.getComponent(item.entity, Sprite);
                const text = this.world.getComponent(item.entity, Text);
                const tex = item.textureId ? this.textureStore.get(item.textureId) : null;

                // ... (Sprite/Text/Default logic) ...
                if (sprite) {
                    this.instanceData[offset + 6] = sprite.uvOffset[0];
                    this.instanceData[offset + 7] = sprite.uvOffset[1];
                    this.instanceData[offset + 8] = sprite.uvScale[0];
                    this.instanceData[offset + 9] = sprite.uvScale[1];

                    let texW = 50.0;
                    let texH = 50.0;
                    if (tex) {
                        texW = tex.width;
                        texH = tex.height;
                    }
                    this.instanceData[offset + 10] = texW * sprite.uvScale[0] * transform.scale[0];
                    this.instanceData[offset + 11] = texH * sprite.uvScale[1] * transform.scale[1];
                } else if (text) {
                    this.instanceData[offset + 6] = 0.0;
                    this.instanceData[offset + 7] = 0.0;
                    this.instanceData[offset + 8] = 1.0;
                    this.instanceData[offset + 9] = 1.0;
                    if (text.width > 0 && text.height > 0) {
                        this.instanceData[offset + 10] = text.width;
                        this.instanceData[offset + 11] = text.height;
                    } else {
                        this.instanceData[offset + 10] = 50.0;
                        this.instanceData[offset + 11] = 50.0;
                    }
                } else {
                    this.instanceData[offset + 6] = 0.0;
                    this.instanceData[offset + 7] = 0.0;
                    this.instanceData[offset + 8] = 1.0;
                    this.instanceData[offset + 9] = 1.0;
                    this.instanceData[offset + 10] = 50.0 * transform.scale[0];
                    this.instanceData[offset + 11] = 50.0 * transform.scale[1];
                }

                instanceCount++;
                currentBatch!.count++;
            }
            if (currentBatch) batches.push(currentBatch);

            // Upload to Buffer
            this.renderer.device.queue.writeBuffer(
                this.instanceBuffer!,
                0,
                this.instanceData,
                0,
                instanceCount * 12
            );

            // Execute Batches
            // Determine Sampler based on PixelArt settings
            const filterMode: GPUFilterMode = this.renderer.pixelArt ? 'nearest' : 'linear';

            for (const batch of batches) {
                const texture = batch.textureId ? this.textureStore.get(batch.textureId) : null;
                // Treat no texture as white rect?
                // The current shader requires a texture bound at group 1 binding 2.
                // We must bind SOMETHING.
                // If pure renderable, we need a 1x1 white texture.
                // ResourceManager should probably have a 'default' texture.
                // Or we just skip batch if no texture (but renderable logic implies colored boxes).
                // Let's assume Renderable always has a texture in current logic?
                // Previous code: `if (!texture) continue;`
                // So colored boxes (Renderable w/o Sprite) were skipped?!
                // Wait, previous code:
                // `const texture = this.resourceManager.getTexture(item.textureId);`
                // `if (sprite) ... renderList.push({..., textureId: sprite.textureId})`
                // `else { ... textureId: '' }`? No, prev code didn't push else if not text/sprite.
                // Actually: `entities = query(Transform)`. Loop. `sprite = get(Sprite)`. `if (sprite) renderList.push`.
                // So strictly only sprites and text were rendered. Pure `Renderable` (colored box) was NOT rendered unless it had sprite/text?
                // Wait, `Renderable` component existed but logic:
                // `const renderable = this.world.getComponent(item.entity, Renderable);`
                // Used for TINT.
                // But `item` comes from `renderList`.
                // And `renderList` is populated only if `sprite` or `text`.
                // So pure Colored Box wasn't working in previous code either?
                // I will maintain this behavior for now to minimize scope creep.
                // Only Sprite/Text are rendered.

                if (!texture) continue;

                const sampler = this.renderer.device.createSampler({
                    magFilter: filterMode,
                    minFilter: filterMode,
                });

                const materialGroup = this.renderer.device.createBindGroup({
                    layout: this.materialBindGroupLayout!,
                    entries: [
                        { binding: 1, resource: sampler },
                        { binding: 2, resource: texture.createView() }
                    ]
                });

                passEncoder.setBindGroup(1, materialGroup);
                passEncoder.draw(6, batch.count, 0, batch.start);
            }

            passEncoder.end();
            this.renderer.device.queue.submit([commandEncoder.finish()]);

            cameraIndex++;
        }
    }
}
