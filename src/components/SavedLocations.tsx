import React, { useEffect, useState } from "react";
import type RpcInterface from "../beacon-rpc/RpcInterface";
import type { SavedLocation } from "../beacon-rpc/RpcInterface";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import AddLocationIcon from "@mui/icons-material/AddLocation";

export function SavedLocations({ rpc }: { rpc: RpcInterface }) {
    const [locations, setLocations] = React.useState<SavedLocation[]>([]);

    useEffect(() => {
        rpc.getSavedLocations().then(response => {
            setLocations(response.Locations);
        });
    }, [rpc]);

    return (
        <>
            <Typography sx={{ mt: 4, mb: 2 }} variant="h6" component="div">
                Saved Locations
            </Typography>

            <NewLocationForm
                rpc={rpc}
                onAdded={(added) => setLocations(prev => [...prev, added])}
            />

            <Stack direction="column" spacing={2} sx={{ mt: 2 }}>
                {locations.map((loc, index) => (
                    <LocationCard
                        idx={index}
                        location={loc}
                        key={index}
                        rpc={rpc}
                        onSaved={(updated) => setLocations(prev => prev.map((l, i) => i === index ? updated : l))}
                    />
                ))}
            </Stack>
        </>
    );
}

function NewLocationForm({ rpc, onAdded }: {
    rpc: RpcInterface;
    onAdded: (added: SavedLocation) => void;
}) {
    const [name, setName] = useState('');
    const [lat, setLat] = useState('');
    const [lng, setLng] = useState('');
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
            setLat('');
            setLng('');
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

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
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
                            onChange={(e) => setLat(e.target.value)}
                            size="small"
                            fullWidth
                        />
                        <TextField
                            label="Lng"
                            value={lng}
                            onChange={(e) => setLng(e.target.value)}
                            size="small"
                            fullWidth
                        />
                    </Stack>

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

function LocationCard({ location, idx, rpc, onSaved }: {
    location: SavedLocation;
    idx: number;
    rpc: RpcInterface;
    onSaved: (updated: SavedLocation) => void;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${location.Lat},${location.Lng}`;

    const handleEdit = () => {
        setEditName(location.Name);
        setSaveError(null);
        setIsEditing(true);
    };

    const handleCancel = () => {
        setSaveError(null);
        setIsEditing(false);
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSaveError(null);
        try {
            const result = await rpc.updateSavedLocation({ Idx: idx, Name: editName, Lat: location.Lat, Lng: location.Lng });
            if (result.Success) {
                onSaved({ Name: editName, Lat: location.Lat, Lng: location.Lng });
                setIsEditing(false);
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

    return (
        <Card elevation={2}>
            <CardContent>
                <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                        <LocationOnIcon color="primary" sx={{ fontSize: 28 }} />
                        <Box sx={{ flex: 1 }}>
                            {isEditing ? (
                                <Stack spacing={1}>
                                    <TextField
                                        label="Name"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        size="small"
                                        fullWidth
                                        autoFocus
                                    />
                                    {saveError && (
                                        <Typography variant="caption" color="error">
                                            {saveError}
                                        </Typography>
                                    )}
                                </Stack>
                            ) : (
                                <>
                                    <Typography variant="h6" sx={{ fontWeight: 600, marginBottom: 0.5 }}>
                                        {location.Name}
                                    </Typography>
                                    <Stack direction="row" spacing={1}>
                                        <Chip
                                            label={`Lat: ${location.Lat.toFixed(6)}`}
                                            size="small"
                                            variant="outlined"
                                            sx={{ fontFamily: 'monospace' }}
                                        />
                                        <Chip
                                            label={`Lng: ${location.Lng.toFixed(6)}`}
                                            size="small"
                                            variant="outlined"
                                            sx={{ fontFamily: 'monospace' }}
                                        />
                                    </Stack>
                                </>
                            )}
                        </Box>
                    </Box>

                    <Stack direction="row" spacing={1} alignItems="center">
                        {isEditing ? (
                            <>
                                <IconButton size="small" color="success" onClick={handleSave} disabled={isSaving} sx={iconButtonSx}>
                                    {isSaving ? <CircularProgress size={16} /> : <CheckIcon fontSize="small" />}
                                </IconButton>
                                <IconButton size="small" color="error" onClick={handleCancel} disabled={isSaving} sx={iconButtonSx}>
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            </>
                        ) : (
                            <>
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
                            </>
                        )}
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
}
