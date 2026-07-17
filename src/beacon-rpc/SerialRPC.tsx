/// <reference types="w3c-web-serial" />
/// RPC over web serial API

import type { DeviceInformation } from "./RpcInterface";
import { BaseRPC } from "./RpcInterface";

export async function connectToSerialDevice(): Promise<SerialRPC> {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });
    return new SerialRPC(port);
}

class SerialRPC extends BaseRPC {
    serial: SerialPort;
    writer: WritableStreamDefaultWriter<Uint8Array<ArrayBufferLike>>;
    reader: ReadableStreamDefaultReader<string>;
    // Resolves once serial.readable has fully unpiped — awaited before
    // serial.close() so the port doesn't stay locked for the next connect.
    private readablePiped: Promise<void>;

    constructor(serial: SerialPort) {
        super();
        this.serial = serial;

        if (!this.serial.readable) {
            throw new Error("Serial port not readable");
        }
        const textDecoder = new TextDecoderStream();
        this.readablePiped = this.serial.readable
            .pipeTo(textDecoder.writable as WritableStream<Uint8Array<ArrayBuffer>>)
            .catch(() => { /* expected once reader.cancel() is called on disconnect */ });
        this.reader = textDecoder.readable
            .pipeThrough(new TransformStream(new LineBreakTransformer()))
            .getReader();

        if (!this.serial.writable) {
            throw new Error("Serial port not writable");
        }
        this.writer = this.serial.writable.getWriter();
    }

    async getDeviceInformation(): Promise<DeviceInformation> {
        return this.call('GetSystemInfo');
    }

    async disconnect(): Promise<void> {
        try {
            await this.reader.cancel();
        } catch {
            // ignore — cancellation racing with an in-flight read is fine
        }
        this.reader.releaseLock();
        await this.readablePiped;

        try {
            await this.writer.close();
        } catch {
            // ignore
        }
        this.writer.releaseLock();

        await this.serial.close();
    }

    async call<T>(functionName: string, params: Record<string, unknown> = {}): Promise<T> {
        const body = { 'F': functionName, ...params };
        const data = "RPC-->" + JSON.stringify(body) + "\n";

        const encoder = new TextEncoder();
        await this.writer.write(encoder.encode(data));

        while (true) {
            const line = (await this.reader.read()).value;
            console.log("Read " + line);

            if (line?.startsWith("RPC<--")) {
                return JSON.parse(line.replace("RPC<--", "")) as T;
            }
        }
    }
}

class LineBreakTransformer implements Transformer<string, string> {
  chunks: string = "";

  transform(chunk: string, controller: TransformStreamDefaultController<string>) {
    // Append new chunks to existing chunks.
    this.chunks += chunk;
    // For each line breaks in chunks, send the parsed lines out.
    const lines = this.chunks.split("\r\n");
    this.chunks = lines.pop() || "";
    lines.forEach((line) => controller.enqueue(line));
  }

  flush(controller: TransformStreamDefaultController<string>) {
    // When the stream is closed, flush any remaining chunks out.
    controller.enqueue(this.chunks);
  }
}
