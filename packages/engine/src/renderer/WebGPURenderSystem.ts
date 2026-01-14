import { System } from '../ecs/System';
import { IWorld } from '../ecs/types';
import { WebGPURenderer } from './WebGPURenderer';
import { Transform } from '../components/Transform';
import { Renderable } from '../components/Renderable';
import { Sprite } from '../components/Sprite';
import { ResourceManager } from '../core/ResourceManager';
import { Camera } from '../components/Camera';
import { Text } from '../components/Text';
// @ts-ignore
import quadShader from './shaders/quad.wgsl';

export class WebGPURenderSystem extends System {
    private renderer: WebGPURenderer;
    private resourceManager: ResourceManager;

    private pipeline: GPURenderPipeline | null = null;
    private vertexBuffer: GPUBuffer | null = null;
    private instanceBuffer: GPUBuffer | null = null;
    private uniformBuffer: GPUBuffer | null = null;

    private viewBindGroup: GPUBindGroup | null = null;
    private viewBindGroupLayout: GPUBindGroupLayout | null = null;
    private materialBindGroupLayout: GPUBindGroupLayout | null = null;

    // Per Instance: Pos(2) + Color(4) + UVOffset(2) + UVScale(2) + Scale(2) = 12 floats = 48 bytes
    private instanceStride = 12 * 4;
    private maxInstances = 10000;
    private instanceData = new Float32Array(this.maxInstances * 12);

    private isReady: boolean = false;
    private world!: IWorld;

    constructor(renderer: WebGPURenderer) {
        super();
        this.renderer = renderer;
        this.resourceManager = new ResourceManager(renderer);
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
            0.0, 50.0,
            50.0, 50.0,

            0.0, 0.0,
            50.0, 50.0,
            50.0, 0.0,
        ]);

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
        this.uniformBuffer = this.renderer.device.createBuffer({
            size: 32,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

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

        // Create initial View Bind Group (will be updated every frame really, but the object structure is static)
        this.viewBindGroup = this.renderer.device.createBindGroup({
            layout: this.viewBindGroupLayout,
            entries: [{
                binding: 0,
                resource: { buffer: this.uniformBuffer }
            }]
        });

        this.isReady = true;
        console.log("WebGPURenderSystem initialized (Batch Rendering Mode)");
    }

    public async update(_dt: number): Promise<void> {
        const width = this.renderer.canvas.width;
        const height = this.renderer.canvas.height;
        if (width === 0 || height === 0) return;

        if (!this.isReady || !this.renderer.device || !this.renderer.context || !this.pipeline || !this.viewBindGroup || !this.materialBindGroupLayout) return;

        // 1. Find Main Camera
        let cameraX = 0;
        let cameraY = 0;
        let cameraZoom = 1.0;

        const cameras = this.world.query(Camera);
        for (const camEntity of cameras) {
            const camera = this.world.getComponent(camEntity, Camera);
            if (camera && camera.isMain) {
                const param = this.world.getComponent(camEntity, Transform);
                if (param) {
                    cameraX = param.x;
                    cameraY = param.y;
                    cameraZoom = camera.zoom;
                    break;
                }
            }
        }



        // Calculate Viewport (Virtual Resolution)
        const viewportW = this.renderer.virtualWidth || width;
        const viewportH = this.renderer.virtualHeight || height;

        // Update Uniforms
        // Struct: viewport(vec2), cameraPos(vec2), zoom(f32), padding(f32)
        // Float32Array: [w, h, x, y, zoom, padding]
        const uniforms = new Float32Array([
            viewportW, viewportH,
            cameraX, cameraY,
            cameraZoom, 0.0
        ]);

        this.renderer.device.queue.writeBuffer(this.uniformBuffer!, 0, uniforms);

        // 2. Prepare Batches
        // Query entities with Transform and Sprite (optional Renderable for tint)

        let entities = this.world.query(Transform);

        // Filter and collect renderable entities
        const renderList: { entity: any; textureId: string }[] = [];

        // Check for Camera
        // We do this loop anyway, so let's find camera here if we haven't found it?
        // No, camera might not have sprite.
        // We'll skip camera search specific logic inside this specific edit block to keep it simple, 
        // will add proper Camera import and query in next step.

        for (const entity of entities) {
            const sprite = this.world.getComponent(entity, Sprite);
            if (sprite) {
                renderList.push({ entity, textureId: sprite.textureId });
            }

            // Text Rendering
            const text = this.world.getComponent(entity, Text);
            if (text) {
                // Generate/Update texture if needed
                if (text.isDirty || !text._textureId) {
                    text._textureId = `text_${entity}`; // Unique ID per entity
                    this.resourceManager.updateTextTexture(text._textureId, text);
                    text.isDirty = false;
                }

                if (text._textureId) {
                    renderList.push({ entity, textureId: text._textureId });
                }
            }
        }

        // Sort by Texture ID to batch
        renderList.sort((a, b) => a.textureId.localeCompare(b.textureId));

        // 3. Populate Instance Buffer & process batches
        let instanceCount = 0;
        const batches: { textureId: string; count: number; start: number }[] = [];
        let currentBatch: { textureId: string; count: number; start: number } | null = null;

        for (const item of renderList) {
            if (instanceCount >= this.maxInstances) break;

            // Ensure texture is loaded
            if (!this.resourceManager.hasTexture(item.textureId) && !this.resourceManager.isLoading(item.textureId)) {
                this.resourceManager.loadTexture(item.textureId).catch(console.error);
            }

            const texture = this.resourceManager.getTexture(item.textureId);
            if (!texture) continue; // Skip if not loaded yet

            // Update Batch info
            if (!currentBatch || currentBatch.textureId !== item.textureId) {
                if (currentBatch) batches.push(currentBatch);
                currentBatch = { textureId: item.textureId, count: 0, start: instanceCount };
            }

            // Fill Instance Data
            const transform = this.world.getComponent(item.entity, Transform)!;
            // Use Renderable for tint if present, else White
            const renderable = this.world.getComponent(item.entity, Renderable);

            const offset = instanceCount * 12;
            // Position
            this.instanceData[offset] = transform.x;
            this.instanceData[offset + 1] = transform.y;

            // Color
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

            // UVs
            const sprite = this.world.getComponent(item.entity, Sprite);
            const text = this.world.getComponent(item.entity, Text);

            if (sprite) {
                this.instanceData[offset + 6] = sprite.uvOffset[0];
                this.instanceData[offset + 7] = sprite.uvOffset[1];
                this.instanceData[offset + 8] = sprite.uvScale[0];
                this.instanceData[offset + 9] = sprite.uvScale[1];

                // Scale (from Transform)
                this.instanceData[offset + 10] = transform.scale[0];
                this.instanceData[offset + 11] = transform.scale[1];
            } else if (text) {
                // Text Rendering
                this.instanceData[offset + 6] = 0.0;
                this.instanceData[offset + 7] = 0.0;
                this.instanceData[offset + 8] = 1.0;
                this.instanceData[offset + 9] = 1.0;

                // Scale (Auto calc from Text dimensions)
                // Base Quad is 50x50.
                // We want final size to be Text.width x Text.height.
                // Scale = Target / 50.
                if (text.width > 0 && text.height > 0) {
                    this.instanceData[offset + 10] = text.width / 50.0;
                    this.instanceData[offset + 11] = text.height / 50.0;
                } else {
                    this.instanceData[offset + 10] = 1.0;
                    this.instanceData[offset + 11] = 1.0;
                }
            } else {
                // Default
                this.instanceData[offset + 6] = 0.0;
                this.instanceData[offset + 7] = 0.0;
                this.instanceData[offset + 8] = 1.0;
                this.instanceData[offset + 9] = 1.0;
                this.instanceData[offset + 10] = 1.0;
                this.instanceData[offset + 11] = 1.0;
            }

            instanceCount++;
            currentBatch!.count++;
        }
        if (currentBatch) batches.push(currentBatch);

        if (instanceCount === 0) return;

        // Upload Instance Buffer
        this.renderer.device.queue.writeBuffer(
            this.instanceBuffer!,
            0,
            this.instanceData,
            0,
            instanceCount * 12
        );

        // 4. Render Pass
        const commandEncoder = this.renderer.device.createCommandEncoder();
        const textureView = this.renderer.context.getCurrentTexture().createView();

        const passEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
            }]
        });

        passEncoder.setPipeline(this.pipeline);
        passEncoder.setBindGroup(0, this.viewBindGroup!);
        passEncoder.setVertexBuffer(0, this.vertexBuffer);
        passEncoder.setVertexBuffer(1, this.instanceBuffer);

        // Determine Sampler based on PixelArt settings
        const filterMode: GPUFilterMode = this.renderer.pixelArt ? 'nearest' : 'linear';

        // Execute Batches
        for (const batch of batches) {
            const texture = this.resourceManager.getTexture(batch.textureId);
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
    }
}
