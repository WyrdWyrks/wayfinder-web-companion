import { useEffect, useRef, useState } from "react";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Tooltip from "@mui/material/Tooltip";
import type { DisplayContentsResponse } from "../beacon-rpc/RpcInterface";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";

const REFRESH_INTERVAL_MS = 750;

export function ScreenTab({ rpc, deviceInfo }: { rpc: any, deviceInfo: any }) {
    const [display, setDisplay] = useState<DisplayContentsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const fetchDisplay = () => {
        setLoading(true);
        rpc.getDisplayContents().then((res: DisplayContentsResponse) => {
            setDisplay(res);
            setLoading(false);
        });
    };

    useEffect(() => {
        if (!autoRefresh) {
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

    useEffect(() => {
        if (!display || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;
        const { width, height, buffer } = display;
        const bin = atob(buffer);
        const imageData = ctx.createImageData(width, height);
        if (deviceInfo && deviceInfo.HardwareVersion === 3) {
            // GFXcanvas1: row-major, each byte is 8 horizontal pixels, LSB is leftmost
            const bytesPerRow = Math.ceil(width / 8);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const byteIndex = y * bytesPerRow + (x >> 3);
                    const bit = 7 - (x & 7);
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
        } else {
            // SSD1306: each byte is a vertical column of 8 pixels
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
        }
        ctx.putImageData(imageData, 0, 0);
    }, [display, deviceInfo]);

    if (loading && !display) return <CircularProgress />;
    if (!display) return <div>No display data</div>;
    return (
        <div style={{ textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}>
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
            </div>
            <canvas ref={canvasRef} width={display.width} height={display.height} style={{ border: "1px solid #ccc", imageRendering: "pixelated", width: "125%", height: "125%" }} />
        </div>
    );
}
