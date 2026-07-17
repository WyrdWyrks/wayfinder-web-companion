import type { ConfigValue } from "./ConfigValue";

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
    clearWifiGeoDb(request?: ClearWifiGeoDbRequest): Promise<ClearWifiGeoDbResponse>;
    insertWifiGeoDbBlock(request: InsertWifiGeoDbBlockRequest): Promise<InsertWifiGeoDbBlockResponse>;
    getWifiGeoDbInfo(request?: GetWifiGeoDbInfoRequest): Promise<GetWifiGeoDbInfoResponse>;
    getDisplayContents(): Promise<DisplayContentsResponse>;

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
}
