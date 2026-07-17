import PWABadge from './components/PWABadge.tsx'
import './App.css'
import CssBaseline from '@mui/material/CssBaseline';
import React from 'react';
import type BeaconState from './BeaconState.tsx';
import ConnectCard from './components/ConnectCard.tsx';
import { DeviceMenu } from './components/DeviceMenu.tsx';
import { ToastProvider, useToast } from './ToastContext.tsx';
import { ErrorHandlingRPC } from './beacon-rpc/ErrorHandlingRPC.tsx';


function AppContent() {
  const { showError } = useToast();
  const [beacon, setBeacon] = React.useState<BeaconState>({ connected: false });

  const rpc = React.useMemo(
    () => beacon.rpc ? new ErrorHandlingRPC(beacon.rpc, showError) : undefined,
    [beacon.rpc, showError]
  );

  // Swap the browser tab favicon to match the connected hardware, restoring
  // the default (PWA-generated) icon when the device disconnects.
  const hardwareVersion = beacon.connected ? beacon.initialDeviceInformation?.HardwareVersion : undefined;
  React.useEffect(() => {
    const icons = document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]');
    if (icons.length === 0) return;
    const originals = Array.from(icons).map((link) => ({ link, href: link.href, type: link.type }));

    if (hardwareVersion && [1, 2, 3].includes(hardwareVersion)) {
      icons.forEach((link) => {
        link.href = `/svg/wayfinder-v${hardwareVersion}.svg`;
        link.type = 'image/svg+xml';
      });
    }

    return () => {
      originals.forEach(({ link, href, type }) => {
        link.href = href;
        link.type = type;
      });
    };
  }, [hardwareVersion]);

  const handleReturnToConnect = async () => {
    // Release the serial port / BLE connection before switching screens —
    // otherwise a later reconnect attempt fails because the previous
    // transport still holds the port open.
    if (rpc) {
      try {
        await rpc.disconnect();
      } catch (e) {
        console.error('Error disconnecting:', e);
      }
    }
    setBeacon({ connected: false });
  };

  return (
    <>
      <CssBaseline />
      {!beacon.connected && !beacon.offline && <ConnectCard setBeacon={setBeacon} />}
      {(beacon.connected || beacon.offline) && (
        <DeviceMenu
          rpc={rpc}
          deviceInfo={beacon.initialDeviceInformation}
          offline={!beacon.connected}
          onReturnToConnect={handleReturnToConnect}
        />
      )}
      <PWABadge />
    </>
  )
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  )
}

export default App
