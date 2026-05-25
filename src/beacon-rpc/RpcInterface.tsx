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

export default interface RpcInterface {
    getDeviceInformation(): Promise<DeviceInformation>;

    getSavedLocations(): Promise<SavedLocationsResponse>;
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
