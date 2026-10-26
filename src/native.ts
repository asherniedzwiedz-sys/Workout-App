import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

/** Expo Go only bundles Expo's own native modules. HealthKit + WatchConnectivity need the EAS development build. */
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
export const hasDevBuildModules = Platform.OS === 'ios' && !isExpoGo;
