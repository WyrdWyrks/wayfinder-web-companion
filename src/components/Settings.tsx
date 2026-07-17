import React, { useEffect, useState, type JSX } from "react";
import type RpcInterface from "../beacon-rpc/RpcInterface";
import type { GetSettingsResponse, Setting } from "../beacon-rpc/RpcInterface";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import PersonIcon from "@mui/icons-material/Person";
import BadgeIcon from "@mui/icons-material/Badge";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import DevicesIcon from "@mui/icons-material/Devices";
import PaletteIcon from "@mui/icons-material/Palette";
import RadioIcon from "@mui/icons-material/Radio";
import SettingsInputAntennaIcon from "@mui/icons-material/SettingsInputAntenna";
import RepeatIcon from "@mui/icons-material/Repeat";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import MemoryIcon from "@mui/icons-material/Memory";
import DeveloperBoardIcon from "@mui/icons-material/DeveloperBoard";
import WifiIcon from "@mui/icons-material/Wifi";
import type { ConfigurableEnumConfigValue, ConfigurableIntegerConfigValue, ConfigurableFloatConfigValue } from "../beacon-rpc/ConfigValue";
import NumberSpinner from "./ext/NumberSpinner";

export function Settings({ rpc }: { rpc?: RpcInterface }) {
    const [settings, setSettings] = React.useState<GetSettingsResponse | null>(null);

    useEffect(() => {
        if (!rpc) return;
        rpc.getSettings().then(response => {
            console.log("Fetched settings:", response);
            setSettings(response);
        });
    }, [rpc]);

    if (!rpc) {
        return (
            <>
                <Typography sx={{ mt: 4, mb: 2 }} variant="h6" component="div">
                    Settings
                </Typography>
                <Alert severity="info">Connect a device to view and edit settings.</Alert>
            </>
        );
    }

    if (settings === null) {
        return <CircularProgress />;
    }

    return (
        <>
            <Typography sx={{ mt: 4, mb: 2 }} variant="h6" component="div">
                Settings
            </Typography>

            <Stack direction="column" spacing={1}>
                {
                    [...Object.entries(settings)].map(([key, value]) =>
                        <SettingItem
                            key={key}
                            name={key}
                            setting={value}
                            rpc={rpc}
                            onSaved={(newVal) => setSettings(prev => {
                                if (!prev) return prev;
                                const s = prev[key];
                                if (typeof s === 'object' && s !== null) {
                                    return { ...prev, [key]: { ...s, cfgVal: newVal } } as GetSettingsResponse;
                                }
                                return prev;
                            })}
                        />
                    )
                }
            </Stack>
        </>
    );
}

export function SettingItem({ name, setting, rpc, onSaved }: {
    name: string;
    setting: Setting;
    rpc: RpcInterface;
    onSaved: (newValue: string | number | boolean) => void;
}): JSX.Element {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState<string | number | boolean>('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const isPrimitive = typeof setting === 'string' || typeof setting === 'number' || typeof setting === 'boolean';
    const configurableTypes = new Set(['bool', 'int', 'float', 'string', 'enum']);
    const isConfigurable = !isPrimitive && configurableTypes.has(setting.cfgType as string);

    const displayValue = (() => {
        if (isPrimitive) return String(setting);

        // For enums, show the friendly label
        if (setting.cfgType === 'enum') {
            const enumSetting = setting as ConfigurableEnumConfigValue;
            const valueIndex = enumSetting.vals.indexOf(enumSetting.cfgVal as number);
            return enumSetting.valTxt[valueIndex];
        }
        
        return String(setting.cfgVal);
    })();

    const handleEdit = () => {
        if (!isPrimitive) {
            const val = setting.cfgVal;
            if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
                setEditValue(val);
            }
        }
        setIsEditing(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSaveError(null);
        try {
            const result = await rpc.updateSetting({ SettingKey: name, SettingValue: editValue });
            if (result.Success) {
                onSaved(editValue);
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

    const handleCancel = () => {
        setSaveError(null);
        setIsEditing(false);
    };

    const renderEditor = () => {
        if (isPrimitive) return null;

        switch (setting.cfgType) {
            case 'bool':
                return (
                    <FormControlLabel
                        control={<Switch checked={Boolean(editValue)} onChange={(e) => setEditValue(e.target.checked)} color="primary" />}
                        label={String(editValue)}
                    />
                );

            case 'int':
            case 'float':
                const numSetting = setting as ConfigurableIntegerConfigValue | ConfigurableFloatConfigValue;
                return (
                    <NumberSpinner
                        value={editValue as number}
                        onValueChange={(value) => setEditValue(value ?? 0)}
                        min={numSetting.minVal}
                        max={numSetting.maxVal}
                        step={numSetting.incVal}
                        size="small"
                    />
                );

            case 'string':
                return <TextField value={editValue} onChange={(e) => setEditValue(e.target.value)} size="small" fullWidth />;

            case 'enum':
                const enumSetting = setting as ConfigurableEnumConfigValue;
                return (
                    <FormControl fullWidth size="small">
                        <Select value={editValue} onChange={(e) => setEditValue(e.target.value as number)}>
                            {enumSetting.vals.map((val, idx) => (
                                <MenuItem key={val} value={val}>{enumSetting.valTxt[idx]} ({val})</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                );

            default:
                return null;
        }
    };

    const iconButtonSx = {
        backgroundColor: 'action.hover',
        '&:hover': { backgroundColor: 'action.selected' }
    };

    const settingIcon = SETTING_ICONS[name];

    return (
        <Card elevation={1} sx={{ backgroundColor: 'background.paper' }}>
            <CardContent sx={{ padding: '1em !important' }}>
                <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                    {settingIcon && (
                        <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
                            {settingIcon}
                        </Box>
                    )}
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
                            {name}
                        </Typography>
                        {isEditing ? (
                            <Box sx={{ marginTop: '0.5em' }}>
                                {renderEditor()}
                                {saveError && (
                                    <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                                        {saveError}
                                    </Typography>
                                )}
                            </Box>
                        ) : (
                            <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                                {displayValue}
                            </Typography>
                        )}
                    </Box>
                    {isConfigurable && (
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
                                <IconButton size="small" color="primary" onClick={handleEdit} sx={iconButtonSx}>
                                    <EditIcon fontSize="small" />
                                </IconButton>
                            )}
                        </Stack>
                    )}
                </Stack>
            </CardContent>
        </Card>
    );
}

const SETTING_ICONS: Record<string, JSX.Element> = {
    "UserID": <PersonIcon fontSize="small" />,
    "User Name": <BadgeIcon fontSize="small" />,
    "Silent Mode": <VolumeOffIcon fontSize="small" />,
    "Device Name": <DevicesIcon fontSize="small" />,
    "Color Theme": <PaletteIcon fontSize="small" />,
    "Theme Red": <PaletteIcon fontSize="small" color="error" />,
    "Theme Green": <PaletteIcon fontSize="small" color="success" />,
    "Theme Blue": <PaletteIcon fontSize="small" color="info" />,
    "Frequency": <RadioIcon fontSize="small" />,
    "Modem Config": <SettingsInputAntennaIcon fontSize="small" />,
    "Broadcast Attempts": <RepeatIcon fontSize="small" />,
    "24H Time": <AccessTimeIcon fontSize="small" />,
    "Firmware Version": <MemoryIcon fontSize="small" />,
    "Hardware Version": <DeveloperBoardIcon fontSize="small" />,
    "WiFi Provisioning": <WifiIcon fontSize="small" />,
};
