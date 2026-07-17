import type RpcInterface from './beacon-rpc/RpcInterface.tsx';
import type { DeviceInformation } from './beacon-rpc/RpcInterface.tsx';


export default interface BeaconState {
  connected: boolean;
  // True when the user chose to browse the app without connecting a real
  // device. Mutually exclusive with `connected` — no rpc/deviceInformation
  // is available, and tabs must not issue any RPC calls in this mode.
  offline?: boolean;
  rpc?: RpcInterface;
  initialDeviceInformation?: DeviceInformation;
}
