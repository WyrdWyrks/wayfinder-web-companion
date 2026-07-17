import Card from '@mui/material/Card';
import Bluetooth from '@mui/icons-material/Bluetooth';
import NetworkWifi from '@mui/icons-material/NetworkWifi';
import Usb from '@mui/icons-material/Usb';
import React from 'react';

import HttpRPC from '../beacon-rpc/HttpRPC.tsx';
import { connectToBluetoothDevice } from '../beacon-rpc/BluetoothRPC.tsx';
import { connectToSerialDevice } from '../beacon-rpc/SerialRPC.tsx';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Stepper from '@mui/material/Stepper';
import Button from '@mui/material/Button';
import FormGroup from '@mui/material/FormGroup';
import Step from '@mui/material/Step';
import StepContent from '@mui/material/StepContent';
import StepLabel from '@mui/material/StepLabel';
import TextField from '@mui/material/TextField';
import type BeaconState from '../BeaconState.tsx';
import type RpcInterface from '../beacon-rpc/RpcInterface.tsx';

type ConnectionMethod = 'serial' | 'wifi' | 'bluetooth';

export default function ConnectCard({ setBeacon }: { setBeacon: React.Dispatch<React.SetStateAction<BeaconState>> }) {
  const [activeStep, setActiveStep] = React.useState(0);
  const [connectionMethod, setConnectionMethod] = React.useState<ConnectionMethod | null>(null);

  const handleNext = (connectionMethod: ConnectionMethod) => {
    setConnectionMethod(connectionMethod);
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setConnectionMethod(null);
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleConnect = async () => {
    setConnectButtonLoading(true);

    let rpc: RpcInterface;
    if (connectionMethod === 'bluetooth') {
      rpc = await connectToBluetoothDevice();
    } else if (connectionMethod == 'serial') {
      rpc = await connectToSerialDevice();
    } else if (connectionMethod === 'wifi') {
      rpc = new HttpRPC(ipAddress);
    } else {
      throw new Error('Invalid connection method');
    }

    const info = await rpc.getDeviceInformation();
    console.log('Connected to device:', info, rpc);
    setBeacon({ connected: true, rpc, initialDeviceInformation: info });

  };

  const [ipAddress, setIpAddress] = React.useState('');
  const handleIpAddressChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIpAddress(event.target.value);
  }

  const [connectButtonLoading, setConnectButtonLoading] = React.useState(false);

  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
      <Card sx={{ padding: '1em', minWidth: '300px', maxWidth: '600px', textAlign: 'center' }}>
        <CardHeader title={
          <Typography color="text.secondary" component="h1" variant="h4">
            Connect Beacon
          </Typography>
        } />
        <CardContent>

          <Box textAlign='left' sx={{ maxWidth: 400 }}>
            <Stepper activeStep={activeStep} orientation="vertical">
              <Step key="Connection Method">
                <StepLabel>Connection Method</StepLabel>
                <StepContent>
                  <Typography>Choose which way you would like to connect to your beacon.</Typography>

                  <Box sx={{ mb: 2 }}>
                    <Button onClick={() => handleNext('serial')} sx={{ mt: 1, mr: 1 }} startIcon={<Usb />} variant='contained'>Serial</Button>
                    <Button onClick={() => handleNext('wifi')} sx={{ mt: 1, mr: 1 }} startIcon={<NetworkWifi />} variant='contained'>WiFi</Button>
                    <Button onClick={() => handleNext('bluetooth')} sx={{ mt: 1, mr: 1 }} startIcon={<Bluetooth />} variant='contained'>Bluetooth</Button>
                  </Box>
                </StepContent>
              </Step>
              <Step key="Connect">
                <StepLabel>Connect {connectionMethod === 'wifi' ? 'with WiFi' : connectionMethod === 'bluetooth' ? 'with Bluetooth' : ''}</StepLabel>
                <StepContent>
                  {connectionMethod == 'serial' && (
                    <>
                      <Typography sx={{mt: 1}} variant='body2'>
                        After pressing the <b>Connect</b> button, select
                        your beacon from your USB devices.
                      </Typography>

                      <FormGroup sx={{ mt: 4 }}>
                        <Box sx={{ mb: 2 }}>
                          <Button onClick={handleBack} sx={{ mt: 1, mr: 1 }}>Back</Button>
                          <Button onClick={handleConnect} sx={{ mt: 1, mr: 1 }} variant='contained' loading={connectButtonLoading}>Connect</Button>
                        </Box>
                      </FormGroup>
                    </>
                  )}

                  {connectionMethod == 'wifi' && (
                    <>
                      <Typography>
                        Select <b>Pair with Terminal</b> on your beacon to see its IP Address.
                      </Typography>
                      <Typography variant='body2'>
                        Make sure it's on the same Network as this device.
                      </Typography>

                      <FormGroup sx={{ mt: 4 }}>
                        <TextField value={ipAddress} onChange={handleIpAddressChange} sx={{ mt: 1, mb: 1 }} label="Beacon IP Address" variant="outlined" />
                        <Box sx={{ mb: 2 }}>
                          <Button onClick={handleBack} sx={{ mt: 1, mr: 1 }}>Back</Button>
                          <Button onClick={handleConnect} sx={{ mt: 1, mr: 1 }} variant='contained' loading={connectButtonLoading}>Connect</Button>
                        </Box>
                      </FormGroup>
                    </>
                  )}

                  {connectionMethod == 'bluetooth' && (
                    <>
                      <Typography>
                        Select <b>Pair Bluetooth</b> on your beacon.
                      </Typography>
                      <Typography sx={{mt: 1}} variant='body2'>
                        After pressing the <b>Connect</b> button, select
                        your beacon and pair it with the PIN code shown on the beacon.
                      </Typography>

                      <FormGroup sx={{ mt: 4 }}>
                        <Box sx={{ mb: 2 }}>
                          <Button onClick={handleBack} sx={{ mt: 1, mr: 1 }}>Back</Button>
                          <Button onClick={handleConnect} sx={{ mt: 1, mr: 1 }} variant='contained' loading={connectButtonLoading}>Connect</Button>
                        </Box>
                      </FormGroup>
                    </>
                  )}
                </StepContent>
              </Step>
            </Stepper>
          </Box>

          <Button
            onClick={() => setBeacon({ connected: false, offline: true })}
            sx={{ mt: 2 }}
            variant="outlined"
            color="secondary"
          >
            Continue without connecting
          </Button>
        </CardContent>
      </Card>
    </Box>
  )
}
