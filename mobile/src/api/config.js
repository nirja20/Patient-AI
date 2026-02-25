import { Platform } from 'react-native';

const DEFAULT_ANDROID_EMULATOR_URL = 'http://10.0.2.2:8000/api/';
const DEFAULT_LOCAL_URL = 'http://127.0.0.1:8000/api/';

export function getApiBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.endsWith('/') ? envUrl : `${envUrl}/`;
  }

  if (Platform.OS === 'android') {
    return DEFAULT_ANDROID_EMULATOR_URL;
  }

  return DEFAULT_LOCAL_URL;
}