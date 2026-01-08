/// <reference types="@webgpu/types" />

export type ResolutionMode = 'none' | 'stretch' | 'fit' | 'pixel-perfect';

export interface WebGPURendererOptions {
    canvas: HTMLCanvasElement | OffscreenCanvas;
    width?: number;
    height?: number;
    virtualWidth?: number;
    virtualHeight?: number;
    resolutionMode?: ResolutionMode;
    pixelArt?: boolean;
}

export class WebGPURenderer {
    public canvas: HTMLCanvasElement | OffscreenCanvas;
    public device: GPUDevice | null = null;
    public context: GPUCanvasContext | null = null;
    public format: GPUTextureFormat = 'bgra8unorm';

    public virtualWidth: number = 0;
    public virtualHeight: number = 0;
    public resolutionMode: ResolutionMode = 'none';
    public pixelArt: boolean = false;

    constructor(options: WebGPURendererOptions) {
        this.canvas = options.canvas;
        if (options.width) this.canvas.width = options.width;
        if (options.height) this.canvas.height = options.height;

        this.virtualWidth = options.virtualWidth || this.canvas.width;
        this.virtualHeight = options.virtualHeight || this.canvas.height;
        this.resolutionMode = options.resolutionMode || 'none';
        this.pixelArt = options.pixelArt || false;
    }

    public async init(): Promise<void> {
        if (!navigator.gpu) {
            throw new Error('WebGPU is not supported in this browser.');
        }

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            throw new Error('No appropriate GPUAdapter found.');
        }

        const device = await adapter.requestDevice();
        device.lost.then((info) => {
            console.error(`WebGPU Device was lost: ${info.reason}, ${info.message}`);
        });
        this.device = device;

        const context = this.canvas.getContext('webgpu');
        if (!context) {
            throw new Error('Could not get WebGPU context.');
        }
        this.context = context;

        this.format = navigator.gpu.getPreferredCanvasFormat();

        this.context.configure({
            device: this.device,
            format: this.format,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
            alphaMode: 'opaque', // Force opaque to fix transparency issue
        });
    }

    public resize(width: number, height: number): void {
        this.canvas.width = width;
        this.canvas.height = height;
        // Context automatically resizes with canvas, but we might need to re-configure if we change format, etc.
    }

    public async loadTexture(url: string): Promise<GPUTexture> {
        if (!this.device) {
            throw new Error('WebGPURenderer not initialized (device is null)');
        }
        const response = await fetch(url);
        const blob = await response.blob();
        const imgBitmap = await createImageBitmap(blob);

        return this.createTextureFromSource(imgBitmap);
    }

    public createTextureFromSource(source: ImageBitmap | HTMLCanvasElement): GPUTexture {
        if (!this.device) {
            throw new Error('WebGPURenderer not initialized (device is null)');
        }
        const texture = this.device.createTexture({
            size: [source.width, source.height, 1],
            format: this.format,
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        });

        this.device.queue.copyExternalImageToTexture(
            { source: source },
            { texture: texture },
            [source.width, source.height]
        );

        return texture;
    }
}
