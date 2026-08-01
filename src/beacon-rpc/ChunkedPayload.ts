// Helpers shared by the RPCs that stream binary data to the device in
// base64 chunks (InsertWifiGeoDbBlock, UploadOTAChunk). Both use the same
// wire convention: base64 of the raw bytes plus a plain sum of those bytes
// as an integrity check, so they share the encoding here.

export function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    const step = 0x8000;
    for (let i = 0; i < bytes.length; i += step) {
        binary += String.fromCharCode(...bytes.subarray(i, i + step));
    }
    return btoa(binary);
}

// Sum of the raw (pre-base64) bytes with uint32 wraparound — matches the
// firmware's `for (...) calculatedChecksum += buffer[i]` on a uint32_t.
export function byteSumChecksum(bytes: Uint8Array): number {
    let checksum = 0;
    for (let i = 0; i < bytes.length; i++) {
        checksum = (checksum + bytes[i]) >>> 0;
    }
    return checksum;
}
