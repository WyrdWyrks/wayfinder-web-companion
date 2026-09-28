/// <reference types="web-bluetooth" />
import { decode, encode } from "@msgpack/msgpack";
import type { DeviceInformation } from "./RpcInterface";
import { BaseRPC, throwIfRpcError } from "./RpcInterface";


const DEGEN_SERVICE_UUID = '033c3d34-8405-46db-8326-07169d5353a9';
const RPC_CHARACTERISTIC_UUID = '033c3d37-8405-46db-8326-07169d5353a9';


// How long to keep retrying the first encrypted read while the user types
// the PIN shown on the beacon into the OS pairing dialog.
const PAIRING_TIMEOUT_MS = 60_000;
const PAIRING_RETRY_INTERVAL_MS = 1_000;

async function getRpcCharacteristic(device: BluetoothDevice): Promise<BluetoothRemoteGATTCharacteristic> {
    const gattServer = device.gatt!.connected ? device.gatt! : await device.gatt!.connect();
    const degenService = await gattServer.getPrimaryService(DEGEN_SERVICE_UUID);
    return degenService.getCharacteristic(RPC_CHARACTERISTIC_UUID);
}

export async function connectToBluetoothDevice(): Promise<BluetoothRPC> {
    if (!navigator.bluetooth) {
        throw new Error(
            "This browser doesn't support Web Bluetooth. Use Chrome or Edge on "
            + 'desktop or Android, or connect with Serial or WiFi instead.'
        );
    }

    const device = await navigator.bluetooth.requestDevice({
        filters: [
            // Firmware advertises the service UUID, which matches regardless
            // of what the user has named the device.
            {services: [DEGEN_SERVICE_UUID]},
            // Older firmware only fits the name in its advertisement.
            {namePrefix: 'Wayfinder'},
            {namePrefix: 'Beacon'},
        ],
        optionalServices: [DEGEN_SERVICE_UUID],
    });

    // The RPC characteristic requires an authenticated link, so the first
    // read fails until the user has entered the PIN shown on the beacon.
    // Keep retrying (reconnecting if pairing dropped the link) until a read
    // succeeds, rather than guessing how long pairing takes.
    const deadline = Date.now() + PAIRING_TIMEOUT_MS;
    let lastError: unknown;
    while (Date.now() < deadline) {
        try {
            const rpcCharacteristic = await getRpcCharacteristic(device);
            await rpcCharacteristic.readValue();
            console.log('Connected to Bluetooth device:', device, rpcCharacteristic);
            return new BluetoothRPC(device, rpcCharacteristic);
        } catch (e) {
            lastError = e;
            console.warn('RPC characteristic not readable yet, waiting for pairing...', e);
            await new Promise(resolve => setTimeout(resolve, PAIRING_RETRY_INTERVAL_MS));
        }
    }

    console.error('Bluetooth pairing did not complete:', lastError);
    device.gatt?.disconnect();
    throw new Error(
        'Pairing with the beacon did not complete. Keep the Pair Bluetooth screen '
        + 'open and enter the PIN it shows. If this beacon was paired before, remove '
        + "it from your computer or phone's Bluetooth settings and try again."
    );
};

const MAX_BLE_CHUNK_SIZE = 500;
// The firmware reassembles each request into a 4096-byte buffer
// (MAX_BLE_RPC_PACKET_SIZE in BluetoothUtilities.hpp) and drops anything
// larger. Leave headroom under it.
const MAX_BLE_REQUEST_SIZE = 4000;

class BluetoothRPC extends BaseRPC {
    device: BluetoothDevice;
    rpcCharacteristic: BluetoothRemoteGATTCharacteristic;
    // Each call is a write-then-read exchange on a single characteristic, so
    // overlapping calls would interleave chunks (or trip Chrome's "GATT
    // operation already in progress"). Calls are chained through this.
    private queue: Promise<unknown> = Promise.resolve();

    // 2048 raw bytes -> ~2.8 KB once base64-encoded and wrapped, safely under
    // MAX_BLE_REQUEST_SIZE.
    get maxUploadBlockBytes(): number {
        return 2048;
    }

    constructor(device: BluetoothDevice, rpcCharacteristic: BluetoothRemoteGATTCharacteristic) {
        super();
        this.device = device;
        this.rpcCharacteristic = rpcCharacteristic;
    }

    async getDeviceInformation(): Promise<DeviceInformation> {
        return this.call('GetSystemInfo');
    }

    async disconnect(): Promise<void> {
        this.device.gatt?.disconnect();
    }

    call<T>(functionName: string, params: Record<string, unknown> = {}): Promise<T> {
        const result = this.queue.then(() => this.callUnqueued<T>(functionName, params));
        this.queue = result.catch(() => undefined);
        return result;
    }

    private async callUnqueued<T>(functionName: string, params: Record<string, unknown>): Promise<T> {
        const body = { 'F': functionName, ...params };
        const data = encode(body);
        if (data.byteLength > MAX_BLE_REQUEST_SIZE) {
            throw new Error(
                `${functionName} request is ${data.byteLength} bytes, larger than the `
                + `${MAX_BLE_REQUEST_SIZE} bytes the device accepts over Bluetooth.`
            );
        }

        // Send in chunks of MAX_BLE_CHUNK_SIZE, start a chunk with 1 if more
        // chunks are coming, 0 if it's the last chunk
        const chunks = [];
        for (let i = 0; i < data.byteLength; i += MAX_BLE_CHUNK_SIZE) {
            chunks.push(data.slice(i, i + MAX_BLE_CHUNK_SIZE));
        }
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const chunkWithHeader = new Uint8Array(chunk.byteLength + 1);
            chunkWithHeader[0] = (i < chunks.length - 1) ? 1 : 0;
            chunkWithHeader.set(new Uint8Array(chunk), 1);
            await this.rpcCharacteristic.writeValueWithResponse(chunkWithHeader);
        }

        // Read the response in chunks
        const dataChunks = [];
        while (true) {
            const value = await this.rpcCharacteristic.readValue();
            if (value.byteLength === 0) {
                // The device had no response ready: it couldn't parse the
                // request (e.g. it overflowed its buffer) and never replied.
                throw new Error(`${functionName} got no response from the device over Bluetooth.`);
            }
            const moreChunks = value.getUint8(0) === 1;
            const chunk = new Uint8Array(value.byteLength - 1);
            chunk.set(new Uint8Array(value.buffer.slice(1)));
            dataChunks.push(chunk);
            console.log('More chunks:', moreChunks);
            if (!moreChunks) break;
        }

        const responseData = await new Blob(dataChunks).arrayBuffer();
        console.log(responseData);
        return throwIfRpcError(functionName, decode(new Uint8Array(responseData)) as T);
    }
}

export default BluetoothRPC;
