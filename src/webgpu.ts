export async function probeWebGpu(): Promise<string> {
  const nav = navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } };
  if (!nav.gpu) return "WebGPU not available in this browser context.";

  try {
    const adapter = await nav.gpu.requestAdapter();
    if (!adapter) return "WebGPU adapter not available.";
    return "WebGPU available. Compute benchmark can run locally.";
  } catch {
    return "WebGPU probe failed.";
  }
}

export async function runWebGpuBenchmark(): Promise<string> {
  const nav = navigator as Navigator & { gpu?: any };
  if (!nav.gpu) return "WebGPU unavailable.";

  try {
    const adapter = await nav.gpu.requestAdapter();
    if (!adapter) return "No WebGPU adapter.";

    const device = await adapter.requestDevice();
    const count = 256;
    const input = new Float32Array(count);
    for (let i = 0; i < count; i += 1) input[i] = i / 7;

    const inputBuffer = device.createBuffer({
      size: input.byteLength,
      usage: (globalThis as any).GPUBufferUsage.STORAGE | (globalThis as any).GPUBufferUsage.COPY_DST
    });

    const outputBuffer = device.createBuffer({
      size: input.byteLength,
      usage: (globalThis as any).GPUBufferUsage.STORAGE | (globalThis as any).GPUBufferUsage.COPY_SRC
    });

    const readBuffer = device.createBuffer({
      size: input.byteLength,
      usage: (globalThis as any).GPUBufferUsage.COPY_DST | (globalThis as any).GPUBufferUsage.MAP_READ
    });

    device.queue.writeBuffer(inputBuffer, 0, input);

    const module = device.createShaderModule({
      code: `
        @group(0) @binding(0) var<storage, read> inputData: array<f32>;
        @group(0) @binding(1) var<storage, read_write> outputData: array<f32>;

        @compute @workgroup_size(64)
        fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
          let idx = gid.x;
          if (idx < ${count}u) {
            outputData[idx] = inputData[idx] * inputData[idx];
          }
        }
      `
    });

    const pipeline = device.createComputePipeline({
      layout: "auto",
      compute: { module, entryPoint: "main" }
    });

    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inputBuffer } },
        { binding: 1, resource: { buffer: outputBuffer } }
      ]
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(count / 64));
    pass.end();

    encoder.copyBufferToBuffer(outputBuffer, 0, readBuffer, 0, input.byteLength);

    const start = performance.now();
    device.queue.submit([encoder.finish()]);
    await device.queue.onSubmittedWorkDone();
    await readBuffer.mapAsync((globalThis as any).GPUMapMode.READ);
    const result = new Float32Array(readBuffer.getMappedRange().slice(0));
    readBuffer.unmap();

    let checksum = 0;
    for (const value of result) checksum += value;

    const ms = performance.now() - start;
    return `WebGPU benchmark complete in ${ms.toFixed(2)}ms • checksum ${checksum.toFixed(2)}`;
  } catch (error) {
    console.error(error);
    return "WebGPU benchmark failed in this browser.";
  }
}
