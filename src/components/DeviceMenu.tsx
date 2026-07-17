import Box from "@mui/material/Box";
import type { DeviceInformation } from "../beacon-rpc/RpcInterface";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import React from "react";
import Settings from "@mui/icons-material/Settings";
import Container from "@mui/material/Container";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Message from "@mui/icons-material/Message";
import PinDrop from "@mui/icons-material/PinDrop";
import SystemUpdateAlt from "@mui/icons-material/SystemUpdateAlt";
import ScreenShare from "@mui/icons-material/ScreenShare";
import UploadFile from "@mui/icons-material/UploadFile";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import type RpcInterface from "../beacon-rpc/RpcInterface";
import { ScreenTab } from "./ScreenTab";
import { SavedMessages } from "./SavedMessages";
import { SavedLocations } from "./SavedLocations";
import { LocationImport } from "./LocationImport";
import { Settings as SettingsComponent } from "./Settings";
import { Firmware } from "./Firmware";

export function DeviceMenu({ rpc, deviceInfo, offline, onReturnToConnect }: {
  rpc?: RpcInterface;
  deviceInfo?: DeviceInformation;
  offline: boolean;
  onReturnToConnect: () => void;
}) {
  const [tabValue, setTabValue] = React.useState(0);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const tabs = [
    { icon: <Message />, label: "Messages", component: <SavedMessages rpc={rpc} /> },
    { icon: <PinDrop />, label: "Locations", component: <SavedLocations rpc={rpc} /> },
    { icon: <UploadFile />, label: "Geolocation", component: <LocationImport rpc={rpc} /> },
    { icon: <Settings />, label: "Settings", component: <SettingsComponent rpc={rpc} /> },
    { icon: <SystemUpdateAlt />, label: "Firmware", component: <Firmware deviceInfo={deviceInfo} rpc={rpc} /> },
  { icon: <ScreenShare />, label: "Screen", component: <ScreenTab rpc={rpc} deviceInfo={deviceInfo} /> },
  ];

  return (
    <>
      <DeviceInfoToolbar deviceInfo={deviceInfo} offline={offline} onReturnToConnect={onReturnToConnect} />

      <Container maxWidth="sm" sx={{ mt: 2}}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          centered={false}
        >
          {tabs.map((tab, index) => (
            <Tab key={index} icon={tab.icon} label={tab.label} sx={{ minWidth: 72 }} />
          ))}
        </Tabs>
        {tabs[tabValue].component}
      </Container>
    </>
  )
}

function DeviceInfoToolbar({ deviceInfo, offline, onReturnToConnect }: {
  deviceInfo?: DeviceInformation;
  offline: boolean;
  onReturnToConnect: () => void;
}) {
  if (offline) {
    return (
      <Box textAlign='center'>
        <Paper elevation={3} sx={{ backgroundColor: 'warning.main', color: 'warning.contrastText' }}>
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            justifyContent="center"
            sx={{ padding: '0.75em 1.5em', flexWrap: 'wrap' }}
          >
            <WifiOffIcon />
            <Box sx={{ textAlign: 'left' }}>
              <Typography variant="body1" sx={{ fontWeight: 700 }}>
                Not Connected
              </Typography>
              <Typography variant="caption">
                Browsing in preview mode — no device data, no changes are saved
              </Typography>
            </Box>
            <Button
              variant="outlined"
              size="small"
              onClick={onReturnToConnect}
              startIcon={<LinkOffIcon />}
              sx={{ ml: { sm: 2 }, borderColor: 'currentColor', color: 'inherit' }}
            >
              Connect Device
            </Button>
          </Stack>
        </Paper>
      </Box>
    );
  }

  const info = deviceInfo!;

  return (
    <Box textAlign='center'>
      <Paper elevation={3}>
        <Stack
          direction="row"
          spacing={{ xs: 1, sm: 2 }}
          alignItems="center"
          justifyContent="center"
          sx={{
            padding: '1em 1.5em',
            flexWrap: 'wrap'
          }}
          useFlexGap
          divider={<Divider orientation="vertical" flexItem />}
        >
          {/* Device Icon */}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {[1, 2, 3].includes(info.HardwareVersion) && (
              <img
                width={90}
                src={`./svg/wayfinder-v${info.HardwareVersion}.svg`}
                alt={`Hardware Version ${info.HardwareVersion}`}
                style={{ display: 'block' }}
              />
            )}
          </Box>

          {/* Device Name */}
          <Box sx={{ minWidth: '150px' }}>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 600 }}>
              Device Name
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              {info.DeviceName}
            </Typography>
          </Box>

          {/* Device ID */}
          <Box sx={{ minWidth: '80px' }}>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 600 }}>
              Device ID
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              0x{info.DeviceID.toString(16).toUpperCase()}
            </Typography>
          </Box>

          {/* Version Information */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 600, marginBottom: '0.3em', display: 'block' }}>
              Version Information
            </Typography>
            <Stack direction="row" spacing={1}>
              <Chip
                label={`Firmware: ${info.FirmwareVersion}`}
                size="small"
                color="primary"
                variant="outlined"
              />
              <Chip
                label={`Hardware: v${info.HardwareVersion}`}
                size="small"
                color="secondary"
                variant="outlined"
              />
            </Stack>
          </Box>

          {/* Return to connect dialog */}
          <Button
            variant="text"
            size="small"
            onClick={onReturnToConnect}
            startIcon={<LinkOffIcon fontSize="small" />}
          >
            Change Device
          </Button>
        </Stack>
      </Paper>
    </Box>
  )
}
