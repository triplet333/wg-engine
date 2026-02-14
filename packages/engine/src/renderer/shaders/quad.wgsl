struct VertexInput {
    @location(0) position: vec2f,
    @location(1) uv: vec2f,
    @location(2) color: vec4f,
};

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f,
    @location(1) uv: vec2f,
};

struct ViewUniforms {
    viewport: vec2f,
    cameraPosition: vec2f,
    cameraZoom: f32,
    _padding: f32,
};

@group(0) @binding(0) var<uniform> view: ViewUniforms;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    // input.position is already in World Space (computed on CPU)
    
    // World to View
    let viewPos = (input.position - view.cameraPosition) * view.cameraZoom;

    // View to Clip
    // Screen Center is (0,0) in Clip Space
    let clipX = (viewPos.x / view.viewport.x) * 2.0 - 1.0;
    // Y is Up in WebGPU (-1 bottom, 1 top). Screen Y is Down.
    // So we flip Y.
    let clipY = -((viewPos.y / view.viewport.y) * 2.0 - 1.0);

    output.position = vec4f(clipX, clipY, 0.0, 1.0);
    output.color = input.color;
    output.uv = input.uv;

    return output;
}

@group(1) @binding(1) var mySampler: sampler;
@group(1) @binding(2) var myTexture: texture_2d<f32>;

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
    let texColor = textureSample(myTexture, mySampler, input.uv);
    return texColor * input.color;
}
