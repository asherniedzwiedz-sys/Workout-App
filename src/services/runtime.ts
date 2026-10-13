import Constants, { ExecutionEnvironment } from 'expo-constants';

/** True inside the Expo Go app, where only Expo's bundled native modules exist. */
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
