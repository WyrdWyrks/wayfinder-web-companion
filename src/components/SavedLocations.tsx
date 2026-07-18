import React, { useEffect, useRef, useState } from "react";
import type RpcInterface from "../beacon-rpc/RpcInterface";
import type { SavedLocation } from "../beacon-rpc/RpcInterface";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import AddLocationIcon from "@mui/icons-material/AddLocation";
import { LocationsMap } from "./ext/LocationsMap";

// Parses lat/lng text-field strings into a map position, or null if either
// is empty/not-a-number yet (map just falls back to its default view).
function parsePosition(lat: string, lng: string): [number, number] | null {
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    if (lat.trim() === '' || lng.trim() === '' || !Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
        return null;
    }
    return [parsedLat, parsedLng];
}

export function SavedLocations({ rpc }: { rpc?: RpcInterface }) {
    const [locations, setLocations] = React.useState<SavedLocation[]>([]);

    // Only one location is ever being positioned at a time: either the new
    // one (editingIdx === null) or an existing one being edited. The shared
    // map on the right reads/writes whichever is active.
    const [editingIdx, setEditingIdx] = useState<number | null>(null);
    const [newPosition, setNewPosition] = useState({ lat: '', lng: '' });
    const [editPosition, setEditPosition] = useState({ lat: '', lng: '' });
    const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});

    useEffect(() => {
        if (!rpc) return;
        rpc.getSavedLocations().then(response => {
            setLocations(response.Locations);
        });
    }, [rpc]);

    const activePosition = editingIdx !== null
        ? parsePosition(editPosition.lat, editPosition.lng)
        : parsePosition(newPosition.lat, newPosition.lng);

    const handleMapPick = (lat: number, lng: number) => {
        if (editingIdx !== null) {
            setEditPosition({ lat: lat.toFixed(6), lng: lng.toFixed(6) });
        } else {
            setNewPosition({ lat: lat.toFixed(6), lng: lng.toFixed(6) });
        }
    };

    // Shared by both the card's Edit button and clicking a pin on the map —
    // either way the target location becomes "active": its card switches to
    // edit mode (scrolled into view) and its pin becomes the movable one.
    const startEditing = (index: number) => {
        const loc = locations[index];
        if (!loc) return;
        setEditingIdx(index);
        setEditPosition({ lat: String(loc.Lat), lng: String(loc.Lng) });
        requestAnimationFrame(() => {
            cardRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    };

    return (
        <>
            <Typography sx={{ mt: 4, mb: 2 }} variant="h6" component="div">
                Saved Locations
            </Typography>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
                <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
                    {rpc ? (
                        <NewLocationForm
                            rpc={rpc}
                            lat={newPosition.lat}
                            lng={newPosition.lng}
                            onPositionChange={(lat, lng) => setNewPosition({ lat, lng })}
                            onAdded={(added) => {
                                setLocations(prev => [...prev, added]);
                                setNewPosition({ lat: '', lng: '' });
                            }}
                        />
                    ) : (
                        <Alert severity="info">Connect a device to add and edit saved locations.</Alert>
                    )}

                    <Stack direction="column" spacing={2} sx={{ mt: 2 }}>
                        {locations.map((loc, index) => (
                            <Box key={index} ref={(el: HTMLDivElement | null) => { cardRefs.current[index] = el; }}>
                                <LocationCard
                                    idx={index}
                                    location={loc}
                                    rpc={rpc!}
                                    isEditing={editingIdx === index}
                                    editLat={editPosition.lat}
                                    editLng={editPosition.lng}
                                    onStartEdit={() => startEditing(index)}
                                    onStopEdit={() => setEditingIdx(null)}
                                    onEditPositionChange={(lat, lng) => setEditPosition({ lat, lng })}
                                    onSaved={(updated) => {
                                        setLocations(prev => prev.map((l, i) => i === index ? updated : l));
                                        setEditingIdx(null);
                                    }}
                                />
                            </Box>
                        ))}
                    </Stack>
                </Box>

                <Box sx={{ flex: 1, minWidth: 0, width: '100%', position: { md: 'sticky' }, top: 16 }}>
                    <LocationsMap
                        locations={locations}
                        activePosition={activePosition}
                        onPick={rpc ? handleMapPick : undefined}
                        onMarkerClick={rpc ? startEditing : undefined}
                    />
                </Box>
            </Stack>
        </>
    );
}

function NewLocationForm({ rpc, lat, lng, onPositionChange, onAdded }: {
    rpc: RpcInterface;
    lat: string;
    lng: string;
    onPositionChange: (lat: string, lng: string) => void;
    onAdded: (added: SavedLocation) => void;
}) {
    const [name, setName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canAdd = name.trim().length > 0 && lat.trim().length > 0 && lng.trim().length > 0;

    const handleAdd = async () => {
        const parsedLat = Number(lat);
        const parsedLng = Number(lng);
        if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
            setError('Lat/Lng must be numbers');
            return;
        }

        setIsSaving(true);
        setError(null);
        try {
            await rpc.addSavedLocation({ Name: name, Lat: parsedLat, Lng: parsedLng });
            onAdded({ Name: name, Lat: parsedLat, Lng: parsedLng });
            setName('');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to add location');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card elevation={2}>
            <CardContent>
                <Stack spacing={2}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <AddLocationIcon color="primary" />
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            New Location
                        </Typography>
                    </Stack>

                    {error && <Alert severity="error">{error}</Alert>}

                    <TextField
                        label="Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        size="small"
                        fullWidth
                    />
                    <TextField
                        label="Lat"
                        value={lat}
                        onChange={(e) => onPositionChange(e.target.value, lng)}
                        size="small"
                        fullWidth
                    />
                    <TextField
                        label="Lng"
                        value={lng}
                        onChange={(e) => onPositionChange(lat, e.target.value)}
                        size="small"
                        fullWidth
                    />

                    <Button
                        variant="contained"
                        onClick={handleAdd}
                        disabled={!canAdd || isSaving}
                        startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <AddLocationIcon />}
                    >
                        Add Location
                    </Button>
                </Stack>
            </CardContent>
        </Card>
    );
}

function LocationCard({ location, idx, rpc, isEditing, editLat, editLng, onStartEdit, onStopEdit, onEditPositionChange, onSaved }: {
    location: SavedLocation;
    idx: number;
    rpc: RpcInterface;
    isEditing: boolean;
    editLat: string;
    editLng: string;
    onStartEdit: () => void;
    onStopEdit: () => void;
    onEditPositionChange: (lat: string, lng: string) => void;
    onSaved: (updated: SavedLocation) => void;
}) {
    const [editName, setEditName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Edit mode can also be entered from outside (clicking this location's
    // pin on the map), bypassing handleEdit below — so name needs to sync
    // here too, not just on the pencil-icon click path.
    useEffect(() => {
        if (isEditing) {
            setEditName(location.Name);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditing]);

    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${location.Lat},${location.Lng}`;

    const handleEdit = () => {
        setSaveError(null);
        onStartEdit();
    };

    const handleCancel = () => {
        setSaveError(null);
        onStopEdit();
    };

    const handleSave = async () => {
        const parsedLat = Number(editLat);
        const parsedLng = Number(editLng);
        if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
            setSaveError('Lat/Lng must be numbers');
            return;
        }

        setIsSaving(true);
        setSaveError(null);
        try {
            const result = await rpc.updateSavedLocation({ Idx: idx, Name: editName, Lat: parsedLat, Lng: parsedLng });
            if (result.Success) {
                onSaved({ Name: editName, Lat: parsedLat, Lng: parsedLng });
            } else {
                setSaveError('Device rejected the update');
            }
        } catch (e) {
            setSaveError(e instanceof Error ? e.message : 'Failed to save');
        } finally {
            setIsSaving(false);
        }
    };

    const iconButtonSx = {
        backgroundColor: 'action.hover',
        '&:hover': { backgroundColor: 'action.selected' }
    };

    if (isEditing) {
        return (
            <Card elevation={2}>
                <CardContent>
                    <Stack spacing={1.5}>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <TextField
                                label="Name"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                size="small"
                                fullWidth
                                autoFocus
                            />
                            <IconButton size="small" color="success" onClick={handleSave} disabled={isSaving} sx={iconButtonSx}>
                                {isSaving ? <CircularProgress size={16} /> : <CheckIcon fontSize="small" />}
                            </IconButton>
                            <IconButton size="small" color="error" onClick={handleCancel} disabled={isSaving} sx={iconButtonSx}>
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Stack>
                        <TextField
                            label="Lat"
                            value={editLat}
                            onChange={(e) => onEditPositionChange(e.target.value, editLng)}
                            size="small"
                            fullWidth
                        />
                        <TextField
                            label="Lng"
                            value={editLng}
                            onChange={(e) => onEditPositionChange(editLat, e.target.value)}
                            size="small"
                            fullWidth
                        />
                        {saveError && (
                            <Typography variant="caption" color="error">
                                {saveError}
                            </Typography>
                        )}
                    </Stack>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card elevation={2}>
            <CardContent>
                <Stack spacing={1}>
                    <Typography variant="h6" sx={{ fontWeight: 600, overflowWrap: 'break-word' }}>
                        {location.Name}
                    </Typography>

                    <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                            <LocationOnIcon color="primary" sx={{ fontSize: 24, flexShrink: 0 }} />
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ fontFamily: 'monospace', overflowWrap: 'break-word' }}
                            >
                                {location.Lat.toFixed(5)}, {location.Lng.toFixed(5)}
                            </Typography>
                        </Stack>

                        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                            <IconButton size="small" color="primary" onClick={handleEdit} sx={iconButtonSx}>
                                <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                                color="primary"
                                aria-label="view on google maps"
                                href={googleMapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <OpenInNewIcon />
                            </IconButton>
                        </Stack>
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
}
