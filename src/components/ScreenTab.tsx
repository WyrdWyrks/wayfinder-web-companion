import { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import KeyboardArrowUp from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
import type { DisplayContentsResponse } from "../beacon-rpc/RpcInterface";
import { DisplayInputID } from "../beacon-rpc/DisplayInput";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";

const REFRESH_INTERVAL_MS = 750;

// The framebuffer is tiny (128px on the long edge), so it's scaled up by a
// whole number of screen pixels — anything fractional makes the nearest-
// neighbour upscale blur unevenly. These bound how much of the page it may
// take before the scale is stepped down.
const MAX_CANVAS_WIDTH_PX = 384;
const MAX_CANVAS_VIEWPORT_HEIGHT = 0.5;

// The device redraws on its own display task, so the framebuffer read has to
// wait for the window's input handler to have run.
const INPUT_SETTLE_MS = 150;

// Where each input's label is drawn on the physical device (see the
// WindowLayer factories in BootstrapDisplay), which is also where the matching
// button sits on the hardware. Clicking a corner of the mirrored screen
// therefore presses the button that corner belongs to.
const INPUT_ZONES = [
    { id: DisplayInputID.BUTTON_1, label: "Button 1", column: 1, row: 1 },
    { id: DisplayInputID.ENC_UP, label: "Encoder up", column: 2, row: 1 },
    { id: DisplayInputID.BUTTON_2, label: "Button 2", column: 3, row: 1 },
    { id: DisplayInputID.BUTTON_3, label: "Button 3 (back)", column: 1, row: 3 },
    { id: DisplayInputID.ENC_DOWN, label: "Encoder down", column: 2, row: 3 },
    { id: DisplayInputID.BUTTON_4, label: "Button 4 (select)", column: 3, row: 3 },
];

export function ScreenTab({ rpc, deviceInfo }: { rpc?: any, deviceInfo?: any }) {
    const [display, setDisplay] = useState<DisplayContentsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [sendingInput, setSendingInput] = useState(false);
    const [scale, setScale] = useState(1);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const fetchDisplay = () => {
        if (!rpc) return;
        setLoading(true);
        rpc.getDisplayContents().then((res: DisplayContentsResponse) => {
            setDisplay(res);
            setLoading(false);
        });
    };

    const sendInput = useCallback(async (inputID: number) => {
        if (!rpc) return;
        setSendingInput(true);
        try {
            await rpc.sendDisplayInput({ InputID: inputID });
            // Auto-refresh is already polling; only pull a frame by hand when
            // it isn't, otherwise the two reads race each other.
            if (!autoRefresh) {
                await new Promise((resolve) => setTimeout(resolve, INPUT_SETTLE_MS));
                setDisplay(await rpc.getDisplayContents());
            }
        } catch {
            // The RPC wrapper has already surfaced this as a toast.
        } finally {
            setSendingInput(false);
        }
    }, [rpc, autoRefresh]);

    useEffect(() => {
        if (!autoRefresh || !rpc) {
            setCountdown(0);
            return;
        }

        let cancelled = false;
        let clearCycle: (() => void) | null = null;

        function runCycle() {
            const start = Date.now();
            setCountdown(0);
            const iv = setInterval(() => {
                const timeElapsed = Date.now() - start;
                const percent = Math.min((timeElapsed / REFRESH_INTERVAL_MS) * 100, 100);
                setCountdown(percent);
            }, 30);
            const to = setTimeout(() => {
                clearInterval(iv);
                if (cancelled) return;
                rpc.getDisplayContents().then((res: DisplayContentsResponse) => {
                    setDisplay(res);
                }).finally(() => {
                    // This rpc just fails sometimes lol.
                    if (!cancelled) {
                        runCycle();
                    }
                });
            }, REFRESH_INTERVAL_MS);
            clearCycle = () => { clearInterval(iv); clearTimeout(to); };
        }

        runCycle();
        return () => { cancelled = true; clearCycle?.(); };
    }, [autoRefresh, rpc]);

    useEffect(() => {
        if (!rpc) {
            setLoading(false);
            return;
        }
        let mounted = true;
        setLoading(true);
        rpc.getDisplayContents().then((res: DisplayContentsResponse) => {
            if (mounted) {
                setDisplay(res);
                setLoading(false);
            }
        });
        return () => { mounted = false; };
    }, [rpc]);

    const displayWidth = display?.width;
    const displayHeight = display?.height;
    useEffect(() => {
        if (!displayWidth || !displayHeight) return;
        const recomputeScale = () => {
            const maxWidth = Math.min(window.innerWidth - 48, MAX_CANVAS_WIDTH_PX);
            const maxHeight = window.innerHeight * MAX_CANVAS_VIEWPORT_HEIGHT;
            const fit = Math.min(maxWidth / displayWidth, maxHeight / displayHeight);
            setScale(Math.max(1, Math.floor(fit)));
        };
        recomputeScale();
        window.addEventListener("resize", recomputeScale);
        return () => window.removeEventListener("resize", recomputeScale);
    }, [displayWidth, displayHeight]);

    useEffect(() => {
        if (!display || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;
        const { width, height, buffer } = display;
        const bin = atob(buffer);
        const imageData = ctx.createImageData(width, height);
        // Both the SSD1306 and the Adafruit SH1107 (1bpp, via Adafruit_GrayOLED)
        // use a page-based buffer: each byte is a vertical column of 8 pixels,
        // laid out as buffer[x + (y / 8) * width] with the LSB at the top.
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const byteIndex = x + Math.floor(y / 8) * width;
                const bit = y % 8;
                const byte = bin.charCodeAt(byteIndex);
                const pixelOn = (byte >> bit) & 1;
                const color = pixelOn ? 255 : 0;
                const idx = (y * width + x) * 4;
                imageData.data[idx + 0] = color;
                imageData.data[idx + 1] = color;
                imageData.data[idx + 2] = color;
                imageData.data[idx + 3] = 255;
            }
        }
        ctx.putImageData(imageData, 0, 0);
    }, [display, deviceInfo]);

    if (!rpc) return <Alert severity="info">Connect a device to view its screen.</Alert>;
    if (loading && !display) return <CircularProgress />;
    if (!display) return <div>No display data</div>;
    return (
        <Stack alignItems="center" spacing={1.5} sx={{ mt: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
                {!autoRefresh &&
                    <Button variant="outlined" size="small" onClick={fetchDisplay} disabled={loading || autoRefresh}>Refresh</Button>}
                <FormControlLabel
                    control={
                        <Checkbox
                            size="small"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                        />
                    }
                    label="Auto-refresh"
                />
                {autoRefresh && (
                    <Tooltip title="Time until next refresh">
                        <LinearProgress sx={{ width: "100px" }} variant="determinate" value={countdown} />
                    </Tooltip>
                )}
            </Stack>

            <Box sx={{ position: "relative", lineHeight: 0 }}>
                <canvas
                    ref={canvasRef}
                    width={display.width}
                    height={display.height}
                    style={{
                        border: "1px solid #ccc",
                        imageRendering: "pixelated",
                        width: display.width * scale,
                        height: display.height * scale,
                    }}
                />
                <Box
                    sx={{
                        position: "absolute",
                        inset: 0,
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gridTemplateRows: "1fr 1fr 1fr",
                        cursor: sendingInput ? "wait" : "default",
                        pointerEvents: sendingInput ? "none" : "auto",
                    }}
                >
                    {/* Duplicates of the button row below, so they're hidden from
                        assistive tech rather than focusable a second time. */}
                    {INPUT_ZONES.map((zone) => (
                        <Tooltip key={zone.id} title={zone.label} disableInteractive>
                            <Box
                                aria-hidden="true"
                                onClick={() => sendInput(zone.id)}
                                sx={{
                                    gridColumn: zone.column,
                                    gridRow: zone.row,
                                    cursor: "pointer",
                                    transition: "background-color 120ms",
                                    "&:hover": { backgroundColor: "rgba(25, 118, 210, 0.35)" },
                                    "&:active": { backgroundColor: "rgba(25, 118, 210, 0.6)" },
                                }}
                            />
                        </Tooltip>
                    ))}
                </Box>
            </Box>

            <Typography variant="caption" color="text.secondary">
                Click a corner of the screen for buttons 1–4, or the top/bottom edge for the encoder.
            </Typography>

            <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center" useFlexGap>
                <ButtonGroup size="small" variant="outlined" disabled={sendingInput}>
                    <Button onClick={() => sendInput(DisplayInputID.BUTTON_1)}>1</Button>
                    <Button onClick={() => sendInput(DisplayInputID.BUTTON_2)}>2</Button>
                    <Tooltip title="Back">
                        <Button onClick={() => sendInput(DisplayInputID.BUTTON_3)}>3</Button>
                    </Tooltip>
                    <Tooltip title="Select">
                        <Button onClick={() => sendInput(DisplayInputID.BUTTON_4)}>4</Button>
                    </Tooltip>
                </ButtonGroup>
                <ButtonGroup size="small" variant="outlined" disabled={sendingInput}>
                    <Button startIcon={<KeyboardArrowUp />} onClick={() => sendInput(DisplayInputID.ENC_UP)}>Enc</Button>
                    <Button startIcon={<KeyboardArrowDown />} onClick={() => sendInput(DisplayInputID.ENC_DOWN)}>Enc</Button>
                </ButtonGroup>
            </Stack>
        </Stack>
    );
}
