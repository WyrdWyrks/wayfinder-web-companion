import { useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER: [number, number] = [20, 0];
const DEFAULT_ZOOM = 2;

// Draws every point as a canvas circle marker via the imperative Leaflet API
// instead of one <CircleMarker> React element per point — at a few thousand
// BSSIDs, mounting that many React components would be the bottleneck, not
// the rendering itself. Canvas rendering (MapContainer's preferCanvas) keeps
// the actual draw fast regardless.
function PointsLayer({ points, centerMarker }: {
    points: Array<{ lat: number; lon: number }>;
    centerMarker?: { lat: number; lon: number; radiusKm?: number } | null;
}) {
    const map = useMap();

    useEffect(() => {
        const layerGroup = L.layerGroup();

        for (const p of points) {
            L.circleMarker([p.lat, p.lon], {
                radius: 3,
                weight: 0,
                fillColor: '#00e5c8',
                fillOpacity: 0.7,
            }).addTo(layerGroup);
        }

        if (centerMarker) {
            L.marker([centerMarker.lat, centerMarker.lon]).addTo(layerGroup);
            if (centerMarker.radiusKm) {
                L.circle([centerMarker.lat, centerMarker.lon], {
                    radius: centerMarker.radiusKm * 1000,
                    color: '#ffb020',
                    weight: 1,
                    fillOpacity: 0.05,
                }).addTo(layerGroup);
            }
        }

        layerGroup.addTo(map);

        const boundsPoints: [number, number][] = points.map(p => [p.lat, p.lon]);
        if (centerMarker) boundsPoints.push([centerMarker.lat, centerMarker.lon]);
        if (boundsPoints.length > 0) {
            map.fitBounds(L.latLngBounds(boundsPoints), { padding: [24, 24] });
        }

        return () => { layerGroup.remove(); };
    }, [points, centerMarker, map]);

    return null;
}

export function BssidScanMap({ points, centerMarker, height = 320 }: {
    points: Array<{ lat: number; lon: number }>;
    centerMarker?: { lat: number; lon: number; radiusKm?: number } | null;
    height?: number;
}) {
    return (
        <MapContainer
            center={DEFAULT_CENTER}
            zoom={DEFAULT_ZOOM}
            preferCanvas
            style={{ height, width: "100%", borderRadius: 8 }}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <PointsLayer points={points} centerMarker={centerMarker} />
        </MapContainer>
    );
}
