import { useEffect, useState } from "react";
import { TileLayer } from "react-leaflet";
import Chip from "@mui/material/Chip";
import CloudOffIcon from "@mui/icons-material/CloudOff";

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Stands in for any tile that fails to load. Leaflet's default is to leave a
// failed tile fully transparent, which offline reads as a half-broken page;
// a flat dark square with its corner drawn in keeps the grid looking
// deliberate and keeps markers legible on top of it.
const ERROR_TILE_URL = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">'
    + '<rect width="256" height="256" fill="#2b2f33"/>'
    + '<path d="M0.5 0.5H255.5V255.5" fill="none" stroke="#3a4046" stroke-width="1"/>'
    + '</svg>');

function useOnline() {
    const [online, setOnline] = useState(() => navigator.onLine);

    useEffect(() => {
        const update = () => setOnline(navigator.onLine);
        window.addEventListener("online", update);
        window.addEventListener("offline", update);
        return () => {
            window.removeEventListener("online", update);
            window.removeEventListener("offline", update);
        };
    }, []);

    return online;
}

// The OSM tile layer plus an offline hint. Renders as a fragment so both go
// straight into the surrounding <MapContainer> — the service worker serves
// previously-viewed tiles from its runtime cache (see vite.config.ts), and
// anything it doesn't have falls back to ERROR_TILE_URL, so an offline map
// still draws its markers and stays pannable.
export function OsmTileLayer() {
    const online = useOnline();

    return (
        <>
            <TileLayer
                attribution={ATTRIBUTION}
                url={TILE_URL}
                errorTileUrl={ERROR_TILE_URL}
            />
            {!online && (
                <Chip
                    size="small"
                    icon={<CloudOffIcon />}
                    label="Offline — showing cached tiles"
                    sx={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        // Above Leaflet's own controls, which top out at 1000.
                        zIndex: 1001,
                        backgroundColor: "rgba(0, 0, 0, 0.75)",
                        // Purely informational — don't intercept map drags.
                        pointerEvents: "none",
                    }}
                />
            )}
        </>
    );
}
