import { useEffect, useState } from "react";
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
import DownloadIcon from "@mui/icons-material/Download";
import { uploadFirmware } from "../firmware/OtaUpdate";
import { versionsMatch, type FirmwareRelease, type useFirmwareReleases } from "../firmware/FirmwareReleases";

// Pulls a firmware image into memory so it can be streamed to the device.
// Only the GitHub Pages mirror can be read this way — see FIRMWARE_MIRROR_BASE.
async function downloadFirmwareAsset(url: string): Promise<Uint8Array> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
    }
    return new Uint8Array(await response.arrayBuffer());
}

function triggerBrowserDownload(release: FirmwareRelease): void {
    const link = document.createElement('a');
    link.href = release.downloadUrl;
    // Cross-origin downloads ignore this, but GitHub already serves the asset
    // as an attachment with the right filename.
    link.download = release.assetName;
    link.click();
}

function formatBytes(bytes: number): string {
    return bytes >= 1024 * 1024
        ? `${(bytes / 1024 / 1024).toFixed(2)} MB`
        : `${(bytes / 1024).toFixed(1)} KB`;
}

function formatDuration(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

// Byte-level progress with an ETA — a full image takes minutes over serial or
// BLE, so a bare percentage doesn't tell the user whether it's still moving.
function UploadProgress({ bytesSent, totalBytes, startedAt }: {
    bytesSent: number;
    totalBytes: number;
    startedAt: number;
}) {
    const percent = totalBytes > 0 ? (bytesSent / totalBytes) * 100 : 0;
    const elapsed = (Date.now() - startedAt) / 1000;
    // No estimate until there's enough of a sample to make one worth showing.
    const remaining = bytesSent > 0 && elapsed > 2
        ? (totalBytes - bytesSent) / (bytesSent / elapsed)
        : null;

    return (
        <Box sx={{ marginBottom: '1em' }}>
            <Stack direction="row" justifyContent="space-between" sx={{ marginBottom: '0.5em' }}>
                <Typography variant="body2" color="text.secondary">
                    {formatBytes(bytesSent)} of {formatBytes(totalBytes)} ({percent.toFixed(1)}%)
                </Typography>
                {remaining !== null && (
                    <Typography variant="body2" color="text.secondary">
                        about {formatDuration(remaining)} left
                    </Typography>
                )}
            </Stack>
            <LinearProgress variant="determinate" value={percent} />
        </Box>
    );
}

export function Firmware({ rpc, deviceInfo, firmwareReleaseState }: {
    rpc?: RpcInterface,
    deviceInfo?: DeviceInformation,
    // Passed down from DeviceMenu, which fetches this once so the Firmware
    // tab can be badged before it's ever opened.
    firmwareReleaseState: ReturnType<typeof useFirmwareReleases>,
}) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [selectedFirmware, setSelectedFirmware] = useState<string | null>(null);
    const [busy, setBusy] = useState<null | 'downloading' | 'uploading'>(null);
    const [progress, setProgress] = useState<{ bytesSent: number, totalBytes: number, startedAt: number } | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
    // Set when an in-browser download of a release asset failed, so the UI can
    // offer the manual download-then-pick route instead.
    const [manualDownload, setManualDownload] = useState<FirmwareRelease | null>(null);

    const uploading = busy !== null;
    const hardwareVersion = deviceInfo?.HardwareVersion;

    const {
        releases: availableFirmware,
        loading: loadingFirmware,
        error: firmwareError,
        reload: reloadFirmware,
    } = firmwareReleaseState;

    // Writing a half-finished image and then losing the tab leaves the device
    // with an erased update partition, so make closing it take a deliberate
    // click while an upload is in flight.
    useEffect(() => {
        if (!uploading) return;
        const warn = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [uploading]);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        // Reset the input so re-picking the same file after a failed attempt
        // still fires a change event.
        event.target.value = '';
        if (file) {
            setSelectedFile(file);
            setMessage(null);
        }
    };

    // Streams an image to the device and reports how it went. `label` names
    // what's being written for the progress and result messages.
    const runUpload = async (image: Uint8Array, label: string) => {
        if (!rpc) return;

        const startedAt = Date.now();
        setBusy('uploading');
        setProgress({ bytesSent: 0, totalBytes: image.length, startedAt });
        setMessage({
            type: 'info',
            text: `Writing ${label} (${formatBytes(image.length)}). Keep this tab open and leave the device connected.`,
        });

        try {
            await uploadFirmware(rpc, image, ({ bytesSent, totalBytes }) => {
                setProgress({ bytesSent, totalBytes, startedAt });
            });
            setMessage({
                type: 'success',
                text: `${label} written in ${formatDuration((Date.now() - startedAt) / 1000)}. `
                    + 'Restart the beacon to boot into the new firmware.',
            });
            setSelectedFile(null);
        } catch (error) {
            setMessage({
                type: 'error',
                text: `Update failed: ${error instanceof Error ? error.message : String(error)}. `
                    + 'The device is still running its current firmware — you can safely try again.',
            });
        } finally {
            setBusy(null);
            setProgress(null);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile || !rpc) return;
        setManualDownload(null);
        await runUpload(new Uint8Array(await selectedFile.arrayBuffer()), selectedFile.name);
    };

    const handleInstallRelease = async () => {
        const release = availableFirmware.find((f) => f.version === selectedFirmware);
        if (!release || !rpc) return;

        setManualDownload(null);
        setBusy('downloading');
        setMessage({ type: 'info', text: `Downloading ${release.assetName}...` });

        let image: Uint8Array;
        try {
            image = await downloadFirmwareAsset(release.mirrorUrl);
        } catch {
            // Releases older than the mirror aren't on it, so fall back to a
            // plain browser download of GitHub's own copy: a navigation isn't
            // subject to the cross-origin rule that blocks fetching it, it just
            // can't hand us the bytes — the user points the picker at the file.
            setBusy(null);
            setManualDownload(release);
            triggerBrowserDownload(release);
            setMessage({
                type: 'info',
                text: `${release.assetName} isn't available for direct install, so it's downloading through `
                    + 'your browser instead. Once it finishes, pick the file under "Upload Custom Firmware" '
                    + 'below to install it.',
            });
            return;
        }

        await runUpload(image, release.version);
    };

    if (!deviceInfo) {
        return (
            <Box sx={{ padding: '2em', maxWidth: '800px', margin: '0 auto' }}>
                <Typography variant="h5" sx={{ marginBottom: '1.5em', fontWeight: 600 }}>
                    Firmware Management
                </Typography>
                <Alert severity="info">Connect a device to manage firmware.</Alert>
            </Box>
        );
    }

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

            {/* Update status — shared by both the release install and the
                custom-file upload, since either can be running here. */}
            {message && (
                <Alert
                    severity={message.type}
                    sx={{ marginBottom: '1em' }}
                    onClose={uploading ? undefined : () => setMessage(null)}
                >
                    {message.text}
                </Alert>
            )}

            {progress && <UploadProgress {...progress} />}

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
                        <Stack spacing={1} sx={{ marginTop: '1em' }}>
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={handleInstallRelease}
                                disabled={!rpc || uploading || versionsMatch(selectedFirmware, deviceInfo.FirmwareVersion)}
                                fullWidth
                            >
                                {busy === 'downloading' ? 'Downloading...' : 'Install Selected Firmware'}
                            </Button>

                            {manualDownload?.version === selectedFirmware && (
                                <Button
                                    variant="outlined"
                                    startIcon={<DownloadIcon />}
                                    href={manualDownload.downloadUrl}
                                    download={manualDownload.assetName}
                                    fullWidth
                                >
                                    Download {manualDownload.assetName} again
                                </Button>
                            )}
                        </Stack>
                    )}
                </CardContent>
            </Card>

            {/* Upload Form */}
            <Card elevation={2}>
                <CardContent>
                    <Typography variant="h6" sx={{ marginBottom: '1em' }}>
                        Upload Custom Firmware
                    </Typography>

                    <Stack spacing={2}>
                        <Box>
                            <input
                                accept=".bin"
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
                                    File size: {formatBytes(selectedFile.size)}
                                </Typography>
                            </Box>
                        )}

                        <Button
                            variant="contained"
                            color="primary"
                            onClick={handleUpload}
                            disabled={!rpc || !selectedFile || uploading}
                            fullWidth
                        >
                            {busy === 'uploading' ? 'Uploading...' : 'Upload Firmware'}
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