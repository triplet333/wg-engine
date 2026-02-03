struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f,
    @location(1) uv: vec2f,
};



struct ViewUniforms {
    viewport: vec2f,
    cameraPosition: vec2f,
    cameraZoom: f32,
    _padding: f32, // explicit padding to align to 16 bytes
};

@group(0) @binding(0) var<uniform> view: ViewUniforms;

@group(1) @binding(1) var mySampler: sampler;
@group(1) @binding(2) var myTexture: texture_2d<f32>;

struct VertexInput {
    @location(0) position: vec2f,
    @location(1) instancePosition: vec2f,
    @location(2) color: vec4f,
    @location(3) uvOffset: vec2f,
    @location(4) uvScale: vec2f,
    @location(5) instanceScale: vec2f,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    // 1. Model to World
    // Apply Scale then Translation
    let scaledPos = input.position * input.instanceScale;
    let worldPos = scaledPos + input.instancePosition;

    // 2. World to Camera (View)
    let viewPos = (worldPos - view.cameraPosition) * view.cameraZoom;

    // 3. View to Clip Space (Projection)
    let clipX = (viewPos.x / view.viewport.x) * 2.0 - 1.0;
    let clipY = -((viewPos.y / view.viewport.y) * 2.0 - 1.0); // WebGPU: Y is up, Screen: Y is down

    output.position = vec4f(clipX, clipY, 0.0, 1.0);
    output.color = input.color;
    
    // UV Calculation: (Base [0..1] * Scale) + Offset
    // Input position is now 0..1 (Unit Quad)
    let baseUV = input.position;
    output.uv = (baseUV * input.uvScale) + input.uvOffset;

    return output;
}

@fragment
fn fs_main(@location(0) color: vec4f, @location(1) uv: vec2f) -> @location(0) vec4f {
    let texColor = textureSample(myTexture, mySampler, uv);
    // Multiply with instance color (tint)
    return texColor * color;
}
