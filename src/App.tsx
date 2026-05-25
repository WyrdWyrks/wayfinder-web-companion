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

  return (
    <>
      <CssBaseline />
      {!beacon.connected && <ConnectCard setBeacon={setBeacon} />}
      {beacon.connected && <DeviceMenu rpc={rpc!} deviceInfo={beacon.initialDeviceInformation!} />}
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
