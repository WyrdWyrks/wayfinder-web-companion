import { BaseRPC } from './RpcInterface';
import type { DeviceInformation } from './RpcInterface';
import type RpcInterface from './RpcInterface';

export class ErrorHandlingRPC extends BaseRPC {
    private inner: RpcInterface;
    private onError: (message: string) => void;

    constructor(inner: RpcInterface, onError: (message: string) => void) {
        super();
        this.inner = inner;
        this.onError = onError;
    }

    async getDeviceInformation(): Promise<DeviceInformation> {
        try {
            return await this.inner.getDeviceInformation();
        } catch (e) {
            this.onError(e instanceof Error ? e.message : String(e));
            throw e;
        }
    }

    async call<T>(functionName: string, params?: Record<string, unknown>): Promise<T> {
        try {
            return await this.inner.call<T>(functionName, params);
        } catch (e) {
            this.onError(e instanceof Error ? e.message : String(e));
            throw e;
        }
    }
}
