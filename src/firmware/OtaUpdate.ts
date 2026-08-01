/*
 * Drives the device's three-call OTA protocol (BeginOTA / UploadOTAChunk /
 * EndOTA, see System_Utils in the firmware). BeginOTA erases the inactive
 * app partition and takes the exact image size; each UploadOTAChunk carries
 * a base64 slice plus a byte-sum checksum and is written straight to flash;
 * EndOTA validates the image and flips the boot partition. The device reboots
 * into the new image on its next restart — nothing here triggers that.
 */

import type RpcInterface from "../beacon-rpc/RpcInterface";
import type { UploadOtaChunkResponse } from "../beacon-rpc/RpcInterface";
import { bytesToBase64, byteSumChecksum } from "../beacon-rpc/ChunkedPayload";

// Raw image bytes per UploadOTAChunk call. The serial RPC channel reads one
// line into a ~4096-byte budget (RpcManager.h's AddRpcChannel(4096, ...));
// base64 inflates raw bytes by ~4/3 and the JSON/msgpack wrapper adds more on
// top, so this stays well under that — same budget the geo DB import uses.
export const OTA_CHUNK_SIZE = 1024;

// A rejected checksum means the device threw the chunk away before touching
// flash, so resending it is safe. A couple of retries covers the occasional
// mangled serial line without turning a real failure into a long stall.
const CHUNK_ATTEMPTS = 3;

// First byte of an ESP-IDF application image (esp_image_header_t.magic).
const ESP_IMAGE_MAGIC = 0xe9;

export type OtaProgress = {
    bytesSent: number;
    totalBytes: number;
    chunkIndex: number; // 0-based index of the chunk just acknowledged
    chunkCount: number;
};

// Cheap sanity check so an obviously wrong file (a .zip, an ELF, the release
// page's HTML) fails here instead of after minutes of uploading — or worse,
// after EndOTA has pointed the bootloader at it.
export function assertLooksLikeFirmware(image: Uint8Array): void {
    if (image.length === 0) {
        throw new Error("That firmware file is empty.");
    }
    if (image[0] !== ESP_IMAGE_MAGIC) {
        throw new Error(
            "That file doesn't look like an ESP32 firmware image — it should start "
            + `with 0x${ESP_IMAGE_MAGIC.toString(16).toUpperCase()}, but starts with `
            + `0x${image[0].toString(16).padStart(2, '0').toUpperCase()}. `
            + "Make sure you picked the .bin built for this hardware version.",
        );
    }
}

function withCode(message: string, code?: number): string {
    return code === undefined ? message : `${message} (esp_err_t ${code})`;
}

async function uploadChunk(
    rpc: RpcInterface,
    request: { chunk: string; checksum: number },
    chunkIndex: number,
): Promise<UploadOtaChunkResponse> {
    let lastError = "unknown error";
    for (let attempt = 1; attempt <= CHUNK_ATTEMPTS; attempt++) {
        const response = await rpc.uploadOtaChunk(request);
        if (!response.error) return response;

        lastError = withCode(response.error, response.code);
        // Anything other than a checksum rejection (a failed esp_ota_write, an
        // inactive session) has already aborted the OTA on the device, so
        // resending would just pile up identical errors.
        if (!/checksum|crc/i.test(response.error)) break;
    }
    throw new Error(`Device rejected chunk ${chunkIndex + 1}: ${lastError}`);
}

// Uploads `image` and leaves the device booting from it on next restart.
// Rejects with a human-readable Error on any device-side refusal; the caller
// is expected to surface that and let the user retry from the top (the device
// aborts its OTA session on write failures, and a fresh BeginOTA re-erases the
// partition anyway).
export async function uploadFirmware(
    rpc: RpcInterface,
    image: Uint8Array,
    onProgress?: (progress: OtaProgress) => void,
): Promise<void> {
    assertLooksLikeFirmware(image);

    const begin = await rpc.beginOta({ size: image.length });
    if (begin.error) {
        throw new Error(withCode(`Device refused to start the update: ${begin.error}`, begin.code));
    }

    const chunkCount = Math.ceil(image.length / OTA_CHUNK_SIZE);
    let bytesSent = 0;

    for (let i = 0; i < chunkCount; i++) {
        const slice = image.subarray(i * OTA_CHUNK_SIZE, Math.min((i + 1) * OTA_CHUNK_SIZE, image.length));
        const response = await uploadChunk(rpc, {
            chunk: bytesToBase64(slice),
            checksum: byteSumChecksum(slice),
        }, i);

        bytesSent += slice.length;

        // The device echoes its own running total. If it ever disagrees with
        // ours, a chunk was dropped or double-written and the image on flash
        // isn't the one we think we sent — stop before EndOTA makes it bootable.
        if (response.total_written !== undefined && response.total_written !== bytesSent) {
            throw new Error(
                `Device is out of sync after chunk ${i + 1}: it has ${response.total_written} bytes, `
                + `we sent ${bytesSent}. Aborting so a half-written image isn't marked bootable.`,
            );
        }

        onProgress?.({ bytesSent, totalBytes: image.length, chunkIndex: i, chunkCount });
    }

    const end = await rpc.endOta();
    if (end.error) {
        throw new Error(withCode(`Device rejected the finished image: ${end.error}`, end.code));
    }
}
