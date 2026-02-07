import { defineConfig } from 'tsup';

export default defineConfig({
    entry: [
        'src/index.ts',
        'src/webgpu.ts',
        'src/input.ts',
        'src/physics.ts',
        'src/ui.ts',
        'src/audio.ts',
        'src/animation.ts'
    ],
    format: ['cjs', 'esm'],
    loader: {
        '.wgsl': 'text',
    },
    dts: false, // We generate dts with tsc manually
});
