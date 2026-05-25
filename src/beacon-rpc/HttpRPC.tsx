import { decode, encode } from "@msgpack/msgpack";
import type { DeviceInformation } from "./RpcInterface";
import { BaseRPC } from "./RpcInterface";

class HttpRPC extends BaseRPC {
    ipAddress: string;

    constructor(ipAddress: string) {
        super();
        this.ipAddress = ipAddress;
    }

    async getDeviceInformation(): Promise<DeviceInformation> {
        const response = await fetch(`http://${this.ipAddress}/`);
        return response.json();
    }

    async call<T>(functionName: string, params: Record<string, unknown> = {}): Promise<T> {
        const body = { 'F': functionName, ...params };
        const response = await fetch(`http://${this.ipAddress}/rpc`, {
            method: 'POST',
            body: encodeMsgPack(body),
        });
        const responseData = await response.arrayBuffer();
        return decode(responseData) as T;
    }
}

function encodeMsgPack(data: any): ArrayBuffer {
    const encoded = encode(data);
    return new Uint8Array(encoded).buffer;
}

export default HttpRPC;