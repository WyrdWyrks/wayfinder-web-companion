import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { SavedLocation } from "../../beacon-rpc/RpcInterface";
import { defaultMarkerIcon as savedIcon, activeMarkerIcon as activeIcon } from "./leafletIcons";

const DEFAULT_CENTER: [number, number] = [20, 0];
const DEFAULT_ZOOM = 2;
const PIN_ZOOM = 15;
const SELECTED_ZOOM = 17;

function ClickHandler({ onPick }: { onPick?: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            onPick?.(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

// With no active selection, fits the view to every saved location. With one
// (a location being added/edited), zooms in tight on just that pin instead
// of framing it alongside every other location — but only when the
// selection changed for a reason other than the user clicking the map to
// move the active pin, since re-fitting after every click would fight the
// zoom level the user just chose.
function FitBounds({ locations, activePosition, lastClickRef }: {
    locations: SavedLocation[];
    activePosition: [number, number] | null;
    lastClickRef: React.RefObject<[number, number] | null>;
}) {
    const map = useMap();

    useEffect(() => {
        const last = lastClickRef.current;
        if (activePosition && last
            && Math.abs(last[0] - activePosition[0]) < 1e-9
            && Math.abs(last[1] - activePosition[1]) < 1e-9) {
            lastClickRef.current = null;
            return;
        }

        if (activePosition) {
            map.setView(activePosition, Math.max(map.getZoom(), SELECTED_ZOOM), { animate: true });
            return;
        }

        const points: [number, number][] = locations.map(l => [l.Lat, l.Lng]);
        if (points.length === 0) return;
        if (points.length === 1) {
            map.setView(points[0], Math.max(map.getZoom(), PIN_ZOOM), { animate: true });
            return;
        }
        map.fitBounds(L.latLngBounds(points), { padding: [32, 32], animate: true });
    }, [locations, activePosition, map, lastClickRef]);

    return null;
}

export function LocationsMap({ locations, activePosition, onPick, onMarkerClick, height = 500 }: {
    locations: SavedLocation[];
    activePosition: [number, number] | null;
    onPick?: (lat: number, lng: number) => void;
    onMarkerClick?: (index: number) => void;
    height?: number;
}) {
    const lastClickRef = useRef<[number, number] | null>(null);

    const handlePick = (lat: number, lng: number) => {
        if (!onPick) return;
        lastClickRef.current = [lat, lng];
        onPick(lat, lng);
    };

    return (
        <MapContainer
            center={DEFAULT_CENTER}
            zoom={DEFAULT_ZOOM}
            style={{ height, width: "100%", borderRadius: 8 }}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickHandler onPick={onPick ? handlePick : undefined} />
            <FitBounds locations={locations} activePosition={activePosition} lastClickRef={lastClickRef} />

            {locations.map((loc, i) => (
                <Marker
                    key={i}
                    position={[loc.Lat, loc.Lng]}
                    icon={savedIcon}
                    eventHandlers={onMarkerClick ? { click: () => onMarkerClick(i) } : undefined}
                >
                    <Popup>{loc.Name}</Popup>
                </Marker>
            ))}

            {activePosition && <Marker position={activePosition} icon={activeIcon} />}
        </MapContainer>
    );
}
