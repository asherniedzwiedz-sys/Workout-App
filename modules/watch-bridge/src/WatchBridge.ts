import { NativeModule, requireOptionalNativeModule } from 'expo';

export interface WatchStatus {
  supported: boolean;
  paired: boolean;
  watchAppInstalled: boolean;
  reachable: boolean;
}

export type WatchBridgeEvents = {
  /** An action message from the watch app (see src/domain/watch.ts). */
  onMessage: (message: Record<string, unknown>) => void;
  onStatusChange: (status: WatchStatus) => void;
};

declare class WatchBridgeModule extends NativeModule<WatchBridgeEvents> {
  getStatus(): WatchStatus;
  /** Sends the latest workout snapshot (JSON) as application context, and live if reachable. */
  updateState(json: string): void;
}

// null in Expo Go, on web and on Android: the native module only exists in an iOS development build.
export default requireOptionalNativeModule<WatchBridgeModule>('WatchBridge');
