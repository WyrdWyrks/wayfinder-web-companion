/*
 * Builds the compact BSSID -> lat/lon binary database consumed by
 * NavigationModule::WifiGeoDb on the device (see
 * esp32-utilities/include/HelperClasses/GPS/WiFiLocationLookup.hpp for the
 * authoritative format description). The device has no room to compute this
 * layout itself, so the PWA precalculates the whole file and streams it over
 * as raw bytes via ClearWifiGeoDb + InsertWifiGeoDbBlock.
 *
 * On-disk format (version 1), all integers little-endian:
 *   Header (32 B): magic "WGDB", version, bucket_bits, record_size(10),
 *     reserved, count(u32), lat_min(i32, deg*1e7), lon_min(i32, deg*1e7),
 *     scale(u32, deg*1e7 per quantization step), reserved(8B)
 *   Bucket index: (2^bucket_bits + 1) x u32 cumulative record counts
 *   Records: count x 10B (6B bssid, 2B quantized lat u16, 2B quantized lon u16),
 *     grouped by bucket in (hash, bssid) order
 */

const HEADER_SIZE = 32;
const RECORD_SIZE = 10;
const VERSION = 1;
const DEFAULT_SCALE = 100; // deg*1e7 units per step (~1.11 m)
const MAX_QUANTIZED = 65535;

export type GeoRecord = {
    bssid: Uint8Array; // 6 raw bytes
    lat: number;
    lon: number;
};

export type ParsedGeoResult = {
    records: GeoRecord[];
    skipped: number;
};

// Accepts "AA:BB:CC:DD:EE:FF", "AA-BB-CC-DD-EE-FF", or bare "AABBCCDDEEFF".
// Segments need not be zero-padded (e.g. "6A:14:1:42:CC:2E" is valid).
export function parseBssid(raw: string): Uint8Array | null {
    const cleaned = raw.trim();
    const parts = cleaned.includes(':') || cleaned.includes('-')
        ? cleaned.split(/[:-]/)
        : cleaned.match(/.{1,2}/g) ?? [];
    if (parts.length !== 6) return null;

    const bytes = new Uint8Array(6);
    for (let i = 0; i < 6; i++) {
        if (!/^[0-9a-fA-F]{1,2}$/.test(parts[i])) return null;
        bytes[i] = parseInt(parts[i], 16);
    }
    return bytes;
}

// Turns loosely-typed parsed JSON results into validated geo records,
// skipping (and counting) anything malformed rather than throwing.
export function parseGeoResults(
    results: Array<{ bssid?: string; lat?: number; lon?: number }>,
): ParsedGeoResult {
    const records: GeoRecord[] = [];
    let skipped = 0;
    for (const r of results) {
        if (!r.bssid || typeof r.lat !== 'number' || typeof r.lon !== 'number') {
            skipped++;
            continue;
        }
        const bssid = parseBssid(r.bssid);
        if (!bssid) {
            skipped++;
            continue;
        }
        records.push({ bssid, lat: r.lat, lon: r.lon });
    }
    return { records, skipped };
}

// FNV-1a over the 6 raw BSSID bytes — must exactly match HashBssid() on the
// device, since the bucket a record is written to has to match where the
// device will look for it.
export function fnv1aBssid(bssid: Uint8Array): number {
    let h = 0x811c9dc5; // 2166136261
    for (let i = 0; i < 6; i++) {
        h ^= bssid[i];
        h = Math.imul(h, 0x01000193); // 16777619
    }
    return h >>> 0;
}

function chooseBucketBits(recordCount: number): number {
    if (recordCount <= 4) return 1;
    const bits = Math.ceil(Math.log2(recordCount / 4));
    return Math.min(16, Math.max(1, bits));
}

function clampU16(v: number): number {
    if (v < 0) return 0;
    if (v > MAX_QUANTIZED) return MAX_QUANTIZED;
    return v;
}

export type WifiGeoDbBuildResult = {
    db: Uint8Array;
    recordCount: number;
    bucketBits: number;
    scale: number;
};

export function buildWifiGeoDb(records: GeoRecord[]): WifiGeoDbBuildResult {
    if (records.length === 0) {
        throw new Error('No records to build a WiFi geo DB from');
    }

    let latMinE7 = Infinity, latMaxE7 = -Infinity;
    let lonMinE7 = Infinity, lonMaxE7 = -Infinity;
    for (const r of records) {
        const latE7 = Math.round(r.lat * 1e7);
        const lonE7 = Math.round(r.lon * 1e7);
        if (latE7 < latMinE7) latMinE7 = latE7;
        if (latE7 > latMaxE7) latMaxE7 = latE7;
        if (lonE7 < lonMinE7) lonMinE7 = lonE7;
        if (lonE7 > lonMaxE7) lonMaxE7 = lonE7;
    }

    // A single scale applies to both axes; widen it past the default until
    // the larger span still fits in 16 bits (mirrors the device comment:
    // scale=100 covers ~73km before it needs coarsening).
    const span = Math.max(latMaxE7 - latMinE7, lonMaxE7 - lonMinE7, 1);
    const scale = span / DEFAULT_SCALE > MAX_QUANTIZED
        ? Math.ceil(span / MAX_QUANTIZED)
        : DEFAULT_SCALE;

    const bucketBits = chooseBucketBits(records.length);
    const numBuckets = 1 << bucketBits;

    type Prepared = { bssid: Uint8Array; latEnc: number; lonEnc: number; hash: number; bucket: number };
    const prepared: Prepared[] = records.map((r) => {
        const latE7 = Math.round(r.lat * 1e7);
        const lonE7 = Math.round(r.lon * 1e7);
        const hash = fnv1aBssid(r.bssid);
        return {
            bssid: r.bssid,
            latEnc: clampU16(Math.round((latE7 - latMinE7) / scale)),
            lonEnc: clampU16(Math.round((lonE7 - lonMinE7) / scale)),
            hash,
            bucket: hash >>> (32 - bucketBits),
        };
    });

    // Sorting is not required for correctness (the device does a linear
    // memcmp scan within a bucket) but keeps builds deterministic and keeps
    // records grouped by bucket, matching the documented layout.
    prepared.sort((a, b) => {
        if (a.bucket !== b.bucket) return a.bucket - b.bucket;
        if (a.hash !== b.hash) return a.hash - b.hash;
        for (let i = 0; i < 6; i++) {
            if (a.bssid[i] !== b.bssid[i]) return a.bssid[i] - b.bssid[i];
        }
        return 0;
    });

    const bucketCounts = new Uint32Array(numBuckets);
    for (const p of prepared) bucketCounts[p.bucket]++;
    const index = new Uint32Array(numBuckets + 1);
    for (let b = 0; b < numBuckets; b++) index[b + 1] = index[b] + bucketCounts[b];

    const indexSize = (numBuckets + 1) * 4;
    const recordsSize = prepared.length * RECORD_SIZE;
    const buf = new ArrayBuffer(HEADER_SIZE + indexSize + recordsSize);
    const view = new DataView(buf);
    const bytes = new Uint8Array(buf);

    bytes.set([0x57, 0x47, 0x44, 0x42], 0); // "WGDB"
    view.setUint8(4, VERSION);
    view.setUint8(5, bucketBits);
    view.setUint8(6, RECORD_SIZE);
    view.setUint8(7, 0);
    view.setUint32(8, prepared.length, true);
    view.setInt32(12, latMinE7, true);
    view.setInt32(16, lonMinE7, true);
    view.setUint32(20, scale, true);
    // bytes 24..32 reserved, already zero.

    let off = HEADER_SIZE;
    for (let i = 0; i < index.length; i++) {
        view.setUint32(off, index[i], true);
        off += 4;
    }

    for (const p of prepared) {
        bytes.set(p.bssid, off);
        view.setUint16(off + 6, p.latEnc, true);
        view.setUint16(off + 8, p.lonEnc, true);
        off += RECORD_SIZE;
    }

    return { db: bytes, recordCount: prepared.length, bucketBits, scale };
}

export type GeoDbBlock = {
    chunk: string; // base64
    checksum: number; // sum of raw bytes, uint32 wraparound
    offset: number;
};

function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    const step = 0x8000;
    for (let i = 0; i < bytes.length; i += step) {
        binary += String.fromCharCode(...bytes.subarray(i, i + step));
    }
    return btoa(binary);
}

// Splits the built DB into device-sized blocks for InsertWifiGeoDbBlock.
// Chunking is app-level (separate RPC calls), not just transport framing —
// it bounds peak heap usage on the device and gives the offset guard
// something to check between calls.
export function chunkWifiGeoDb(db: Uint8Array, chunkSize = 4096): GeoDbBlock[] {
    const blocks: GeoDbBlock[] = [];
    for (let offset = 0; offset < db.length; offset += chunkSize) {
        const slice = db.subarray(offset, Math.min(offset + chunkSize, db.length));
        let checksum = 0;
        for (let i = 0; i < slice.length; i++) {
            checksum = (checksum + slice[i]) >>> 0;
        }
        blocks.push({ chunk: bytesToBase64(slice), checksum, offset });
    }
    return blocks;
}
