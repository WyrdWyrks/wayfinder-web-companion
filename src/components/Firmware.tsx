import { useCallback, useEffect, useState } from "react";
import type { DeviceInformation } from "../beacon-rpc/RpcInterface";
import type RpcInterface from "../beacon-rpc/RpcInterface";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Link from "@mui/material/Link";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import MemoryIcon from "@mui/icons-material/Memory";

const RELEASES_API_URL =
    'https://api.github.com/repos/Blake-Ballew/Celestial-Wayfinder/releases?per_page=30';

// Release assets are named e.g. "firmware-hardware-v3-3.7.0.bin"; the captured
// group is the hardware version the firmware is built for.
const FIRMWARE_ASSET_REGEX = /^firmware-hardware-v(\d+)-.+\.bin$/i;

// How many compatible releases to show.
const MAX_RELEASES = 5;

type FirmwareRelease = {
    version: string;
    date: string;
    description: string;
    hwVersion: number;
    downloadUrl: string;
    htmlUrl: string;
    assetName: string;
};

// Compare firmware version strings ignoring a leading "v" (tags are "v3.7.0"
// while the device reports e.g. "3.7.0").
function versionsMatch(a: string, b: string): boolean {
    return a.replace(/^v/i, '') === b.replace(/^v/i, '');
}

// Fetch the most recent releases that ship a firmware asset for the given
// hardware version. Throws on network/HTTP/parse failures so callers can
// surface a friendly error.
async function fetchCompatibleFirmware(
    hardwareVersion: number,
    signal: AbortSignal,
): Promise<FirmwareRelease[]> {
    const response = await fetch(RELEASES_API_URL, {
        headers: { Accept: 'application/vnd.github+json' },
        signal,
    });
    if (!response.ok) {
        throw new Error(`GitHub returned ${response.status} ${response.statusText}`);
    }

    const releases: unknown = await response.json();
    if (!Array.isArray(releases)) {
        throw new Error('Unexpected response from the GitHub releases API');
    }

    const compatible: FirmwareRelease[] = [];
    // GitHub returns releases newest-first, so the first matches are the latest.
    for (const release of releases) {
        if (compatible.length >= MAX_RELEASES) break;
        if (release.draft || release.prerelease) continue;

        const asset = (release.assets ?? []).find((a: { name?: string }) => {
            const match = a.name ? FIRMWARE_ASSET_REGEX.exec(a.name) : null;
            return match !== null && Number(match[1]) === hardwareVersion;
        });
        if (!asset) continue;

        compatible.push({
            version: release.tag_name,
            date: (release.published_at ?? '').slice(0, 10),
            description: (release.body ?? '').trim() || release.name || 'No release notes provided.',
            hwVersion: hardwareVersion,
            downloadUrl: asset.browser_download_url,
            htmlUrl: release.html_url,
            assetName: asset.name,
        });
    }

    return compatible;
}

export function Firmware({ rpc, deviceInfo }: { rpc: RpcInterface, deviceInfo: DeviceInformation }) {
    rpc; // TODO: use rpc here to actually upload firmware

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [selectedFirmware, setSelectedFirmware] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);

    const [availableFirmware, setAvailableFirmware] = useState<FirmwareRelease[]>([]);
    const [loadingFirmware, setLoadingFirmware] = useState(true);
    const [firmwareError, setFirmwareError] = useState<string | null>(null);
    // Bumping this re-runs the fetch effect (used by the "Retry" button).
    const [reloadCount, setReloadCount] = useState(0);

    const hardwareVersion = deviceInfo.HardwareVersion;

    useEffect(() => {
        const controller = new AbortController();
        setLoadingFirmware(true);
        setFirmwareError(null);

        fetchCompatibleFirmware(hardwareVersion, controller.signal)
            .then((releases) => {
                setAvailableFirmware(releases);
                setLoadingFirmware(false);
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) return;
                setAvailableFirmware([]);
                setFirmwareError(
                    error instanceof Error ? error.message : 'Failed to load firmware releases.',
                );
                setLoadingFirmware(false);
            });

        return () => controller.abort();
    }, [hardwareVersion, reloadCount]);

    const reloadFirmware = useCallback(() => setReloadCount((c) => c + 1), []);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setMessage(null);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        setUploading(true);
        setUploadProgress(0);
        setMessage({ type: 'info', text: 'Starting firmware upload...' });

        try {
            // TODO: Implement actual firmware upload using rpc
            // Simulate upload progress
            for (let i = 0; i <= 100; i += 10) {
                setUploadProgress(i);
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            setMessage({ type: 'success', text: 'Firmware uploaded successfully! Device will restart.' });
            setSelectedFile(null);
        } catch (error) {
            setMessage({ type: 'error', text: `Upload failed: ${error}` });
        } finally {
            setUploading(false);
        }
    };

    return (
        <Box sx={{ padding: '2em', maxWidth: '800px', margin: '0 auto' }}>
            <Typography variant="h5" sx={{ marginBottom: '1.5em', fontWeight: 600 }}>
                Firmware Management
            </Typography>

            {/* Current Firmware Info */}
            <Card elevation={2} sx={{ marginBottom: '2em' }}>
                <CardContent>
                    <Stack direction="row" spacing={2} alignItems="center">
                        <MemoryIcon color="primary" sx={{ fontSize: 40 }} />
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600 }}>
                                Current Firmware
                            </Typography>
                            <Typography variant="h6" sx={{ fontFamily: 'monospace' }}>
                                {deviceInfo.FirmwareVersion}
                            </Typography>
                        </Box>
                        <Stack direction="row" spacing={1}>
                            <Chip label={`Hardware v${deviceInfo.HardwareVersion}`} color="secondary" variant="outlined" />
                        </Stack>
                    </Stack>
                </CardContent>
            </Card>

            {/* Available Firmware */}
            <Card elevation={2} sx={{ marginBottom: '2em' }}>
                <CardContent>
                    <Typography variant="h6" sx={{ marginBottom: '1em' }}>
                        Available Firmware
                    </Typography>

                    {loadingFirmware && (
                        <Stack direction="row" spacing={2} alignItems="center" sx={{ padding: '1em' }}>
                            <CircularProgress size={20} />
                            <Typography variant="body2" color="text.secondary">
                                Loading releases for hardware v{hardwareVersion}…
                            </Typography>
                        </Stack>
                    )}

                    {!loadingFirmware && firmwareError && (
                        <Alert
                            severity="error"
                            action={
                                <Button color="inherit" size="small" onClick={reloadFirmware}>
                                    Retry
                                </Button>
                            }
                        >
                            Could not load firmware releases: {firmwareError}
                        </Alert>
                    )}

                    {!loadingFirmware && !firmwareError && availableFirmware.length === 0 && (
                        <Alert severity="info">
                            No firmware releases were found for hardware v{hardwareVersion}.
                        </Alert>
                    )}

                    {!loadingFirmware && !firmwareError && availableFirmware.length > 0 && (
                    <Stack spacing={1}>
                        {availableFirmware.map((firmware) => (
                            <Card
                                key={firmware.version}
                                variant="outlined"
                                sx={{
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    border: selectedFirmware === firmware.version ? '2px solid' : '1px solid',
                                    borderColor: selectedFirmware === firmware.version ? 'primary.main' : 'divider',
                                    backgroundColor: selectedFirmware === firmware.version ? 'action.selected' : 'transparent',
                                    '&:hover': {
                                        backgroundColor: 'action.hover',
                                        borderColor: 'primary.light'
                                    }
                                }}
                                onClick={() => setSelectedFirmware(firmware.version)}
                            >
                                <CardContent sx={{ padding: '1em !important' }}>
                                    <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                                        <Box sx={{ minWidth: 0 }}>
                                            <Typography variant="h6" sx={{ fontFamily: 'monospace', marginBottom: '0.25em' }}>
                                                {firmware.version}
                                            </Typography>
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                                sx={{
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden',
                                                    whiteSpace: 'pre-line',
                                                }}
                                            >
                                                {firmware.description}
                                            </Typography>
                                            <Link
                                                href={firmware.htmlUrl}
                                                target="_blank"
                                                rel="noopener"
                                                variant="caption"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                Release notes
                                            </Link>
                                        </Box>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <Chip label={firmware.date} size="small" variant="outlined" />
                                            {versionsMatch(firmware.version, deviceInfo.FirmwareVersion) && (
                                                <Chip label="Current" size="small" color="success" />
                                            )}
                                        </Stack>
                                    </Stack>
                                </CardContent>
                            </Card>
                        ))}
                    </Stack>
                    )}

                    {selectedFirmware && (
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={() => {
                                // TODO: Download and install selected firmware
                                setMessage({ type: 'info', text: `Installing firmware ${selectedFirmware}...` });
                            }}
                            disabled={uploading || versionsMatch(selectedFirmware, deviceInfo.FirmwareVersion)}
                            fullWidth
                            sx={{ marginTop: '1em' }}
                        >
                            Install Selected Firmware
                        </Button>
                    )}
                </CardContent>
            </Card>

            {/* Upload Form */}
            <Card elevation={2}>
                <CardContent>
                    <Typography variant="h6" sx={{ marginBottom: '1em' }}>
                        Upload Custom Firmware
                    </Typography>

                    {message && (
                        <Alert severity={message.type} sx={{ marginBottom: '1em' }}>
                            {message.text}
                        </Alert>
                    )}

                    <Stack spacing={2}>
                        <Box>
                            <input
                                accept=".bin,.hex,.elf"
                                style={{ display: 'none' }}
                                id="firmware-file-input"
                                type="file"
                                onChange={handleFileSelect}
                                disabled={uploading}
                            />
                            <label htmlFor="firmware-file-input">
                                <Button
                                    variant="outlined"
                                    component="span"
                                    startIcon={<UploadFileIcon />}
                                    disabled={uploading}
                                    fullWidth
                                >
                                    {selectedFile ? selectedFile.name : 'Select Firmware File'}
                                </Button>
                            </label>
                        </Box>

                        {selectedFile && (
                            <Box>
                                <Typography variant="body2" color="text.secondary" sx={{ marginBottom: '0.5em' }}>
                                    File size: {(selectedFile.size / 1024).toFixed(2)} KB
                                </Typography>
                            </Box>
                        )}

                        {uploading && (
                            <Box>
                                <Typography variant="body2" color="text.secondary" sx={{ marginBottom: '0.5em' }}>
                                    Upload progress: {uploadProgress}%
                                </Typography>
                                <LinearProgress variant="determinate" value={uploadProgress} />
                            </Box>
                        )}

                        <Button
                            variant="contained"
                            color="primary"
                            onClick={handleUpload}
                            disabled={!selectedFile || uploading}
                            fullWidth
                        >
                            {uploading ? 'Uploading...' : 'Upload Firmware'}
                        </Button>

                        <Alert severity="warning">
                            <Typography variant="body2">
                                <strong>Warning:</strong> Ensure you select the correct firmware file for your hardware version.
                                Uploading incorrect firmware may brick your device.
                            </Typography>
                        </Alert>
                    </Stack>
                </CardContent>
            </Card>
        </Box>
    );
}