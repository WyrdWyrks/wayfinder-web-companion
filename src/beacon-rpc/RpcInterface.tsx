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


export default interface RpcInterface {
    getDeviceInformation(): Promise<DeviceInformation>;
    getSavedMessages(): Promise<SavedMessagesResponse>;
    getSavedLocations(): Promise<SavedLocationsResponse>;
    getSettings(): Promise<GetSettingsResponse>;
    getDisplayContents(): Promise<DisplayContentsResponse>;
    call<T>(functionName: string, params?: Record<string, unknown>): Promise<T>;
}

export abstract class BaseRPC implements RpcInterface {
    abstract getDeviceInformation(): Promise<DeviceInformation>;
    abstract call<T>(functionName: string, params?: Record<string, unknown>): Promise<T>;

    getSavedMessages(): Promise<SavedMessagesResponse> {
        return this.call('GetSavedMessages');
    }
    getSavedLocations(): Promise<SavedLocationsResponse> {
        return this.call('GetSavedLocations');
    }
    getSettings(): Promise<GetSettingsResponse> {
        return this.call('GetSettings');
    }
    getDisplayContents(): Promise<DisplayContentsResponse> {
        return this.call('GetDisplayContents');
    }
}
