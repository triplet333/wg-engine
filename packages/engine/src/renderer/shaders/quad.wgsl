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
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    // 1. Model to World
    // Quad is 50x50, anchored at top-left (0,0).
    let worldPos = input.position + input.instancePosition;

    // 2. World to Camera (View)
    // Shift by camera position, scale by zoom
    // Center the camera: (WorldPos - CameraPos) * Zoom
    // But usually (0,0) is top-left in screen space games.
    // If we want CameraPos to be the center of the screen, we add viewport/2.
    // Let's stick to: CameraPos is the top-left corner of the view for now (simplest 2D scrolling).
    let viewPos = (worldPos - view.cameraPosition) * view.cameraZoom;

    // 3. View to Clip Space (Projection)
    // Convert 0..ViewportWidth to -1..1
    // X: (Pos / Width) * 2 - 1
    // Y: 1 - (Pos / Height) * 2 (Flip Y because WebGPU Y is up, Screen Y is down)

    let clipX = (viewPos.x / view.viewport.x) * 2.0 - 1.0;
    let clipY = -((viewPos.y / view.viewport.y) * 2.0 - 1.0); // WebGPU: Y is up, Screen: Y is down

    output.position = vec4f(clipX, clipY, 0.0, 1.0);
    output.color = input.color;
    output.uv = input.position / 50.0; // Normalized UV 0..1

    return output;
}

@fragment
fn fs_main(@location(0) color: vec4f, @location(1) uv: vec2f) -> @location(0) vec4f {
    let texColor = textureSample(myTexture, mySampler, uv);
  // Multiply with instance color (tint)
    return texColor * color;
}
