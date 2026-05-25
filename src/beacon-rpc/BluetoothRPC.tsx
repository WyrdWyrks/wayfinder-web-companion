/// <reference types="web-bluetooth" />
import { decode, encode } from "@msgpack/msgpack";
import type { DeviceInformation } from "./RpcInterface";
import { BaseRPC } from "./RpcInterface";


const DEGEN_SERVICE_UUID = '033c3d34-8405-46db-8326-07169d5353a9';
const RPC_CHARACTERISTIC_UUID = '033c3d37-8405-46db-8326-07169d5353a9';


export async function connectToBluetoothDevice(): Promise<BluetoothRPC> {
    const device = await navigator.bluetooth.requestDevice({
        filters: [
            {namePrefix: 'Beacon'},
        ],
        optionalServices: [DEGEN_SERVICE_UUID],
    });

    let gattServer = await device.gatt!.connect();
    let degenService = await gattServer.getPrimaryService(DEGEN_SERVICE_UUID);

    let rpcCharacteristic = await degenService.getCharacteristic(RPC_CHARACTERISTIC_UUID);
    console.log('Connected to Bluetooth device:', device, rpcCharacteristic);

    // Check if we are paired by trying to read the characteristic. If not, we
    // need to give the user some time to pair.
    try {
        await rpcCharacteristic.readValue();
    } catch (e) {
        console.error('Error reading RPC characteristic, waiting for pairing...', e);

        await new Promise(resolve => setTimeout(resolve, 100));

        gattServer = await device.gatt!.connect();
        degenService = await gattServer.getPrimaryService(DEGEN_SERVICE_UUID);
        rpcCharacteristic = await degenService.getCharacteristic(RPC_CHARACTERISTIC_UUID);

        // Wait either 30 seconds or until the window has focus again.
        async function waitForFocusOrTimeout() {
            if (document.hasFocus()) {
                await new Promise(resolve => setTimeout(resolve, 5_000));
            }

            for (let i = 0; i < 30; i++) {
                if (document.hasFocus()) {
                    return;
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        await waitForFocusOrTimeout();
    }

    return new BluetoothRPC(device, rpcCharacteristic);
};

const MAX_BLE_CHUNK_SIZE = 500;

class BluetoothRPC extends BaseRPC {
    device: BluetoothDevice;
    rpcCharacteristic: BluetoothRemoteGATTCharacteristic;

    constructor(device: BluetoothDevice, rpcCharacteristic: BluetoothRemoteGATTCharacteristic) {
        super();
        this.device = device;
        this.rpcCharacteristic = rpcCharacteristic;
    }

    async getDeviceInformation(): Promise<DeviceInformation> {
        return this.call('GetSystemInfo');
    }

    async call<T>(functionName: string, params: Record<string, unknown> = {}): Promise<T> {
        const body = { 'F': functionName, ...params };
        const data = encode(body);

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
            const moreChunks = value.getUint8(0) === 1;
            const chunk = new Uint8Array(value.byteLength - 1);
            chunk.set(new Uint8Array(value.buffer.slice(1)));
            dataChunks.push(chunk);
            console.log('More chunks:', moreChunks);
            if (!moreChunks) break;
        }

        const responseData = await new Blob(dataChunks).arrayBuffer();
        console.log(responseData);
        return decode(new Uint8Array(responseData)) as T;
    }
}

export default BluetoothRPC;
