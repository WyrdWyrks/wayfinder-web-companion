import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Leaflet's default L.Icon references its marker images via relative paths
// that only resolve when leaflet.css is served from its own package
// directory — under Vite's bundling those paths 404. Importing the images
// directly lets the bundler rewrite them to real asset URLs, so any L.Marker
// built without an explicit `icon` (e.g. raw `L.marker(...)` calls) needs
// this default applied, not just the ones built through react-leaflet.
export const defaultMarkerIcon = L.icon({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

// Same marker image, tinted red via CSS (see App.css's .active-location-marker
// rule) so a specific pin can be made visually distinct from the rest.
export const activeMarkerIcon = L.icon({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
    className: 'active-location-marker',
});
