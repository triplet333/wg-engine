import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts', 'src/webgpu.ts', 'src/input.ts'],
    format: ['cjs', 'esm'],
    loader: {
        '.wgsl': 'text',
    },
    dts: false, // We generate dts with tsc manually
});
