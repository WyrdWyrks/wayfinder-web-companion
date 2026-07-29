import type RpcInterface from './beacon-rpc/RpcInterface.tsx';
import type { DeviceInformation } from './beacon-rpc/RpcInterface.tsx';

export type ConnectionMethod = 'serial' | 'wifi' | 'bluetooth';

export default interface BeaconState {
  connected: boolean;
  // True when the user chose to browse the app without connecting a real
  // device. Mutually exclusive with `connected` — no rpc/deviceInformation
  // is available, and tabs must not issue any RPC calls in this mode.
  offline?: boolean;
  rpc?: RpcInterface;
  // How the device was reached. Some features (screen mirroring) only work
  // over serial, so the UI needs the transport even though the RPC wrappers
  // hide it. Undefined in offline mode.
  connectionMethod?: ConnectionMethod;
  initialDeviceInformation?: DeviceInformation;
}
