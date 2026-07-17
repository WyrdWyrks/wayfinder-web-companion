import { useCallback, useEffect, useRef, useState } from "react";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import LinearProgress from "@mui/material/LinearProgress";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import RefreshIcon from "@mui/icons-material/Refresh";
import StorageIcon from "@mui/icons-material/Storage";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import MapIcon from "@mui/icons-material/Map";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import type RpcInterface from "../beacon-rpc/RpcInterface";
import type { GetWifiGeoDbInfoResponse } from "../beacon-rpc/RpcInterface";
import { buildWifiGeoDb, chunkWifiGeoDb, parseGeoResults } from "../wifi-geo-db/GeoDbBuilder";

const LVCC_TEMPLATE_URL = "/data/lvcc-locations.json";

// Raw bytes per InsertWifiGeoDbBlock call. The device's serial RPC channel
// reads one Serial.readStringUntil('\n') line into a ~4096-byte budget
// (RpcManager.h's AddRpcChannel(4096, ...)); base64 inflates raw bytes by
// ~4/3 and the JSON wrapper ({"F":...,"chunk":"...","checksum":...,"offset":...})
// adds more on top, so this needs to stay well under that, not at it.
const BLOCK_SIZE = 1024;

// Shape produced by the BSSID-scan query tool. `query` describes the scan
// that generated the file; `results` is the BSSID -> location data itself.
type BssidQueryFile = {
    query?: {
        name?: string;
        center?: { lat?: number; lon?: number };
        radius_km?: number;
        queried_at?: string;
    };
    count?: number;
    results?: Array<{ bssid?: string; lat?: number; lon?: number; dist_km?: number }>;
};

type LoadedFile = {
    name: string;
    sizeBytes: number;
    content: string;
    parsed: BssidQueryFile | null;
};

export function LocationImport({ rpc }: { rpc: RpcInterface }) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [loaded, setLoaded] = useState<LoadedFile | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loadingTemplate, setLoadingTemplate] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [importMessage, setImportMessage] = useState<{ type: "success" | "error" | "info", text: string } | null>(null);

    const [deviceDbInfo, setDeviceDbInfo] = useState<GetWifiGeoDbInfoResponse | null>(null);
    const [deviceDbLoading, setDeviceDbLoading] = useState(true);
    const [deviceDbError, setDeviceDbError] = useState<string | null>(null);

    const refreshDeviceDbInfo = useCallback(async () => {
        setDeviceDbLoading(true);
        setDeviceDbError(null);
        try {
            const info = await rpc.getWifiGeoDbInfo();
            setDeviceDbInfo(info);
        } catch (e) {
            setDeviceDbInfo(null);
            setDeviceDbError(e instanceof Error ? e.message : "Failed to query device.");
        } finally {
            setDeviceDbLoading(false);
        }
    }, [rpc]);

    useEffect(() => {
        refreshDeviceDbInfo();
    }, [refreshDeviceDbInfo]);

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        setError(null);
        try {
            const content = await file.text();
            const parsed = JSON.parse(content);
            setLoaded({ name: file.name, sizeBytes: file.size, content, parsed });
        } catch {
            setLoaded(null);
            setError(`"${file.name}" is not valid JSON.`);
        }
    };

    const handleUseTemplate = async () => {
        setError(null);
        setLoadingTemplate(true);
        try {
            const response = await fetch(LVCC_TEMPLATE_URL);
            if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
            const content = await response.text();
            const parsed = JSON.parse(content);
            setLoaded({ name: "lvcc-locations.json", sizeBytes: content.length, content, parsed });
        } catch (e) {
            setError(e instanceof Error ? `Failed to load LVCC template: ${e.message}` : "Failed to load LVCC template.");
        } finally {
            setLoadingTemplate(false);
        }
    };

    const handleDownloadTemplate = () => {
        const link = document.createElement("a");
        link.href = LVCC_TEMPLATE_URL;
        link.download = "lvcc-locations.json";
        link.click();
    };

    const handleImportToDevice = async () => {
        const results = loaded?.parsed?.results;
        if (!results || results.length === 0) {
            setImportMessage({ type: "error", text: "Loaded file has no results to import." });
            return;
        }

        setImporting(true);
        setImportProgress(0);
        setImportMessage({ type: "info", text: "Building WiFi geo DB..." });

        try {
            const { records, skipped } = parseGeoResults(results);
            if (records.length === 0) {
                throw new Error("No valid BSSID/lat/lon entries found in this file.");
            }

            const { db, recordCount } = buildWifiGeoDb(records);
            const blocks = chunkWifiGeoDb(db, BLOCK_SIZE);

            setImportMessage({ type: "info", text: "Clearing existing WiFi geo DB on device..." });
            const clearResult = await rpc.clearWifiGeoDb();
            if (clearResult.error) {
                throw new Error(`Device rejected clear: ${clearResult.error}`);
            }

            for (let i = 0; i < blocks.length; i++) {
                const block = blocks[i];
                setImportMessage({ type: "info", text: `Uploading block ${i + 1} of ${blocks.length}...` });
                const result = await rpc.insertWifiGeoDbBlock({
                    chunk: block.chunk,
                    checksum: block.checksum,
                    offset: block.offset,
                });
                if (result.error) {
                    throw new Error(`Device rejected block ${i + 1}: ${result.error}`);
                }
                setImportProgress(Math.round(((i + 1) / blocks.length) * 100));
            }

            setImportMessage({
                type: "success",
                text: `Imported ${recordCount.toLocaleString()} BSSIDs (${(db.length / 1024).toFixed(1)} KB)`
                    + (skipped > 0 ? `, skipped ${skipped} invalid entries.` : "."),
            });
            await refreshDeviceDbInfo();
        } catch (e) {
            setImportMessage({ type: "error", text: e instanceof Error ? e.message : "Import failed." });
        } finally {
            setImporting(false);
        }
    };

    const canImport = !!loaded?.parsed?.results?.length;

    return (
        <Box sx={{ padding: "2em", maxWidth: "800px", margin: "0 auto" }}>
            <Typography variant="h5" sx={{ marginBottom: "1.5em", fontWeight: 600 }}>
                Import Wifi Geolocation Data
            </Typography>

            <Card elevation={2} sx={{ marginBottom: "1.5em" }}>
                <CardContent>
                    <Stack direction="row" spacing={2} alignItems="center">
                        <StorageIcon color="primary" sx={{ fontSize: 32 }} />
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600 }}>
                                WiFi Geo DB On Device
                            </Typography>
                            {deviceDbLoading && (
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <CircularProgress size={16} />
                                    <Typography variant="body2" color="text.secondary">Querying device...</Typography>
                                </Stack>
                            )}
                            {!deviceDbLoading && deviceDbError && (
                                <Typography variant="body2" color="error">{deviceDbError}</Typography>
                            )}
                            {!deviceDbLoading && !deviceDbError && deviceDbInfo && (
                                deviceDbInfo.open ? (
                                    <Typography variant="body1" sx={{ fontFamily: "monospace" }}>
                                        {deviceDbInfo.count.toLocaleString()} records ({deviceDbInfo.bucket_bits}-bit buckets)
                                    </Typography>
                                ) : (
                                    <Typography variant="body2" color="text.secondary">No DB stored on device</Typography>
                                )
                            )}
                        </Box>
                        <IconButton onClick={refreshDeviceDbInfo} disabled={deviceDbLoading} size="small">
                            <RefreshIcon fontSize="small" />
                        </IconButton>
                    </Stack>
                </CardContent>
            </Card>

            <Card elevation={2}>
                <CardContent>
                    <Typography variant="h6" sx={{ marginBottom: "1em" }}>
                        Bulk BSSID Location Data
                    </Typography>

                    {error && (
                        <Alert severity="error" sx={{ marginBottom: "1em" }} onClose={() => setError(null)}>
                            {error}
                        </Alert>
                    )}

                    <Stack spacing={2}>
                        <Box>
                            <input
                                ref={fileInputRef}
                                accept=".json,application/json"
                                style={{ display: "none" }}
                                id="location-file-input"
                                type="file"
                                onChange={handleFileSelect}
                            />
                            <label htmlFor="location-file-input">
                                <Button
                                    variant="outlined"
                                    component="span"
                                    startIcon={<UploadFileIcon />}
                                    fullWidth
                                >
                                    Upload JSON File
                                </Button>
                            </label>
                        </Box>

                        <Stack direction="row" spacing={2}>
                            <Button
                                variant="outlined"
                                startIcon={<MapIcon />}
                                onClick={handleUseTemplate}
                                disabled={loadingTemplate}
                                fullWidth
                            >
                                Use LVCC Template
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<DownloadIcon />}
                                onClick={handleDownloadTemplate}
                                fullWidth
                            >
                                Download LVCC Template
                            </Button>
                        </Stack>

                        {loaded && <LoadedFileSummary loaded={loaded} />}

                        {importMessage && (
                            <Alert severity={importMessage.type} onClose={() => setImportMessage(null)}>
                                {importMessage.text}
                            </Alert>
                        )}

                        {importing && (
                            <Box>
                                <Typography variant="body2" color="text.secondary" sx={{ marginBottom: "0.5em" }}>
                                    {importProgress}%
                                </Typography>
                                <LinearProgress variant="determinate" value={importProgress} />
                            </Box>
                        )}

                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<CloudUploadIcon />}
                            onClick={handleImportToDevice}
                            disabled={!canImport || importing}
                            fullWidth
                        >
                            {importing ? "Importing..." : "Import to Device"}
                        </Button>
                    </Stack>
                </CardContent>
            </Card>
        </Box>
    );
}

function LoadedFileSummary({ loaded }: { loaded: LoadedFile }) {
    const query = loaded.parsed?.query;
    const bssidCount = loaded.parsed?.count ?? loaded.parsed?.results?.length;
    const queriedAt = query?.queried_at ? new Date(query.queried_at) : null;

    return (
        <Alert severity="success" icon={false}>
            <Stack spacing={1}>
                <Typography variant="body2">
                    Loaded <strong>{loaded.name}</strong> ({(loaded.sizeBytes / 1024).toFixed(2)} KB)
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {query?.name && <Chip size="small" label={query.name} />}
                    {bssidCount !== undefined && (
                        <Chip size="small" label={`${bssidCount.toLocaleString()} BSSIDs`} color="primary" variant="outlined" />
                    )}
                    {query?.center?.lat !== undefined && query?.center?.lon !== undefined && (
                        <Chip
                            size="small"
                            variant="outlined"
                            sx={{ fontFamily: "monospace" }}
                            label={`Center: ${query.center.lat.toFixed(5)}, ${query.center.lon.toFixed(5)}`}
                        />
                    )}
                    {query?.radius_km !== undefined && (
                        <Chip size="small" variant="outlined" label={`Radius: ${query.radius_km} km`} />
                    )}
                    {queriedAt && !isNaN(queriedAt.getTime()) && (
                        <Chip size="small" variant="outlined" label={`Queried: ${queriedAt.toLocaleString()}`} />
                    )}
                </Stack>
            </Stack>
        </Alert>
    );
}
