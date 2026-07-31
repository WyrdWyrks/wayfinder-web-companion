import type { ConfigValue } from "./ConfigValue";

// When an RPC doesn't succeed, the firmware discards the payload and replies
// with just a return code under "R" (see RpcUtils.h's RpcReturnCode /
// RPC_RETURN_CODE_FIELD, and RpcManager.h's ProcessRpcChannels). Without
// checking for it, callers happily destructure that error object as if it
// were real data and fail later with confusing undefined-property errors.
const RPC_RETURN_CODE_FIELD = "R";

const RPC_RETURN_CODE_MESSAGES: Record<number, string> = {
    2: "the device does not recognize this command — it may still be booting, or be running firmware that predates it",
    3: "the device reported an error running this command",
};

export class RpcError extends Error {
    readonly returnCode: number;
    constructor(functionName: string, returnCode: number) {
        const detail = RPC_RETURN_CODE_MESSAGES[returnCode] ?? `error code ${returnCode}`;
        super(`${functionName} failed: ${detail}`);
        this.name = "RpcError";
        this.returnCode = returnCode;
    }
}

// Throws when `response` is a firmware error reply; otherwise returns it
// unchanged. Every transport runs its responses through this so the failure
// surfaces at the call that caused it.
export function throwIfRpcError<T>(functionName: string, response: T): T {
    if (response && typeof response === "object") {
        const code = (response as Record<string, unknown>)[RPC_RETURN_CODE_FIELD];
        // Success can also come back as a bare {"R": 0}; only non-zero is an error.
        if (typeof code === "number" && code !== 0 && code !== 1) {
            throw new RpcError(functionName, code);
        }
    }
    return response;
}

export type DeviceInformation = {
    DeviceName: string;
    DeviceID: number;
    FirmwareVersion: string;
    HardwareVersion: number;
}

export type SavedMessagesResponse = {
    Messages: string[];
}

export type SavedLocation = {
    Name: string;
    Lat: number;
    Lng: number;
}

export type SavedLocationsResponse = {
    Locations: SavedLocation[];
}

export type Setting = number | string | boolean | ConfigValue;
export type GetSettingsResponse = Record<string, Setting>;

export type DisplayContentsResponse = {
    width: number,
    height: number,
    buffer: string,
    // Set when the frame came from a virtual (canvas-backed) display rather
    // than a physical panel, which means the buffer is laid out the way
    // Adafruit's GFXcanvas1 stores it instead of the panel's page format.
    virtual?: boolean,
}

export type SendDisplayInputRequest = {
    InputID: number;
}

export type SendDisplayInputResponse = {
    Success: boolean;
}

export type AddSavedMessageRequest = {
    Message: string;
}

export type DeleteSavedMessageRequest = {
    Idx: number;
}

export type UpdateSavedMessageRequest = {
    Idx: number;
    Message: string;
}

export type UpdateSavedMessageResponse = {
    Success: boolean;
}

export type UpdateSettingRequest = {
    SettingKey: string;
    SettingValue: string | number | boolean;
}

export type UpdateSettingResponse = {
    Success: boolean;
}

export type UpdateSavedLocationRequest = {
    Idx: number;
    Name: string;
    Lat: number;
    Lng: number;
}

export type UpdateSavedLocationResponse = {
    Success: boolean;
}

export type AddSavedLocationRequest = {
    Name: string;
    Lat: number;
    Lng: number;
}

export type DeleteSavedLocationRequest = {
    Idx: number;
}

export type DeleteSavedLocationResponse = {
    Success: boolean;
}

export type ClearWifiGeoDbRequest = {
    path?: string;
}

export type ClearWifiGeoDbResponse = {
    status?: string;
    error?: string;
}

export type InsertWifiGeoDbBlockRequest = {
    chunk: string; // base64-encoded raw DB bytes
    checksum: number; // sum of the raw (pre-base64) bytes, uint32 wraparound
    offset?: number; // expected file size before this write; guards against a lost/reordered block
    path?: string;
}

export type InsertWifiGeoDbBlockResponse = {
    written?: number;
    total_size?: number;
    error?: string;
    expected_offset?: number;
}

export type GetWifiGeoDbInfoRequest = {
    path?: string;
}

export type GetWifiGeoDbInfoResponse = {
    open: boolean;
    count: number;
    bucket_bits: number;
}

export default interface RpcInterface {
    getDeviceInformation(): Promise<DeviceInformation>;

    // Releases any exclusive transport resource (serial port, BLE GATT
    // connection) so a later connection attempt doesn't fail because the
    // previous one is still holding it open. No-op for transports that
    // don't hold one (e.g. HTTP).
    disconnect(): Promise<void>;

    getSavedLocations(): Promise<SavedLocationsResponse>;
    addSavedLocation(request: AddSavedLocationRequest): Promise<void>;
    updateSavedLocation(request: UpdateSavedLocationRequest): Promise<UpdateSavedLocationResponse>;
    deleteSavedLocation(request: DeleteSavedLocationRequest): Promise<DeleteSavedLocationResponse>;
    clearWifiGeoDb(request?: ClearWifiGeoDbRequest): Promise<ClearWifiGeoDbResponse>;
    insertWifiGeoDbBlock(request: InsertWifiGeoDbBlockRequest): Promise<InsertWifiGeoDbBlockResponse>;
    getWifiGeoDbInfo(request?: GetWifiGeoDbInfoRequest): Promise<GetWifiGeoDbInfoResponse>;
    getDisplayContents(): Promise<DisplayContentsResponse>;
    sendDisplayInput(request: SendDisplayInputRequest): Promise<SendDisplayInputResponse>;

    getSavedMessages(): Promise<SavedMessagesResponse>;
    updateSavedMessage(request: UpdateSavedMessageRequest): Promise<UpdateSavedMessageResponse>;
    addSavedMessage(request: AddSavedMessageRequest): Promise<void>;
    deleteSavedMessage(request: DeleteSavedMessageRequest): Promise<void>;

    getSettings(): Promise<GetSettingsResponse>;
    updateSetting(request: UpdateSettingRequest): Promise<UpdateSettingResponse>;

    // Generic call method for any RPC function, with optional parameters
    call<T>(functionName: string, params?: Record<string, unknown>): Promise<T>;
}

export abstract class BaseRPC implements RpcInterface {
    abstract getDeviceInformation(): Promise<DeviceInformation>;
    abstract call<T>(functionName: string, params?: Record<string, unknown>): Promise<T>;

    async disconnect(): Promise<void> {
        // No exclusive resource to release by default.
    }

    getSavedMessages(): Promise<SavedMessagesResponse> {
        return this.call('GetSavedMessages');
    }
    updateSavedMessage(request: UpdateSavedMessageRequest): Promise<UpdateSavedMessageResponse> {
        return this.call('UpdateSavedMessage', request);
    }
    addSavedMessage(request: AddSavedMessageRequest): Promise<void> {
        return this.call('AddSavedMessage', request);
    }
    deleteSavedMessage(request: DeleteSavedMessageRequest): Promise<void> {
        return this.call('DeleteSavedMessage', request);
    }
    getSavedLocations(): Promise<SavedLocationsResponse> {
        return this.call('GetSavedLocations');
    }
    addSavedLocation(request: AddSavedLocationRequest): Promise<void> {
        return this.call('AddSavedLocation', request);
    }
    updateSavedLocation(request: UpdateSavedLocationRequest): Promise<UpdateSavedLocationResponse> {
        return this.call('UpdateSavedLocation', request);
    }
    deleteSavedLocation(request: DeleteSavedLocationRequest): Promise<DeleteSavedLocationResponse> {
        return this.call('DeleteSavedLocation', request);
    }
    clearWifiGeoDb(request: ClearWifiGeoDbRequest = {}): Promise<ClearWifiGeoDbResponse> {
        return this.call('ClearWifiGeoDb', request);
    }
    insertWifiGeoDbBlock(request: InsertWifiGeoDbBlockRequest): Promise<InsertWifiGeoDbBlockResponse> {
        return this.call('InsertWifiGeoDbBlock', request);
    }
    getWifiGeoDbInfo(request: GetWifiGeoDbInfoRequest = {}): Promise<GetWifiGeoDbInfoResponse> {
        return this.call('GetWifiGeoDbInfo', request);
    }
    getSettings(): Promise<GetSettingsResponse> {
        return this.call('GetSettings');
    }
    updateSetting(request: UpdateSettingRequest): Promise<UpdateSettingResponse> {
        return this.call('UpdateSetting', request);
    }
    getDisplayContents(): Promise<DisplayContentsResponse> {
        return this.call('GetDisplayContents');
    }
    sendDisplayInput(request: SendDisplayInputRequest): Promise<SendDisplayInputResponse> {
        return this.call('SendDisplayInput', request);
    }
}
