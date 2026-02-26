import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrl } from './config';

const ACCESS_KEY = 'mediassist_access_token';
const REFRESH_KEY = 'mediassist_refresh_token';

async function getAccessToken() {
  return AsyncStorage.getItem(ACCESS_KEY);
}

export async function setAuthTokens(access, refresh) {
  const pairs = [];
  if (access) pairs.push([ACCESS_KEY, access]);
  if (refresh) pairs.push([REFRESH_KEY, refresh]);
  if (pairs.length) {
    await AsyncStorage.multiSet(pairs);
  }
}

export async function clearAuthTokens() {
  await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY]);
}

export async function getStoredAccessToken() {
  return getAccessToken();
}

async function request(path, options = {}, requireAuth = true) {
  const headers = { ...(options.headers || {}) };
  const baseUrl = getApiBaseUrl();

  if (requireAuth) {
    const token = await getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  let response;
  try {
    response = await fetch(baseUrl + path, {
      ...options,
      headers,
    });
  } catch (error) {
    throw new Error(
      `Network error: unable to reach API at ${baseUrl}. Ensure backend is running, phone is on same network, and this URL opens on your phone browser.`
    );
  }

  const contentType = response.headers.get('content-type') || '';
  const rawText = await response.text();
  let data = null;

  if (contentType.includes('application/json')) {
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch (error) {
      data = null;
    }
  }

  if (!response.ok) {
    const htmlError =
      rawText &&
      (rawText.startsWith('<!DOCTYPE') || rawText.startsWith('<html'));
    const errorMessage =
      (data && (data.error || data.detail)) ||
      (htmlError ? 'Backend returned an HTML error page. Check Django server logs and host settings.' : '') ||
      rawText ||
      `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return data || {};
}

export async function signup(username, email, password) {
  const data = await request(
    'auth/signup/',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    },
    false,
  );

  await setAuthTokens(data.access, data.refresh);
  return data.user;
}

export async function login(username, password) {
  const data = await request(
    'auth/login/',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    },
    false,
  );

  await setAuthTokens(data.access, data.refresh);
  return data.user;
}

export async function googleLogin(idToken) {
  const data = await request(
    'auth/google-login/',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: idToken }),
    },
    false,
  );

  await setAuthTokens(data.access, data.refresh);
  return data.user;
}

export async function getCurrentUser() {
  return request('auth/me/');
}

export async function updateCurrentUser(profile) {
  return request('auth/me/', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
}

export async function getConversations() {
  return request('conversations/');
}

export async function getConversation(conversationId) {
  return request(`conversation/${conversationId}/`);
}

export async function sendMessage(message, conversationId, preferredLanguage = '') {
  return request('chat/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
      is_voice: false,
      preferred_language: preferredLanguage && preferredLanguage !== 'auto' ? preferredLanguage : '',
    }),
  });
}

export async function editChatMessage(chatId, message) {
  return request(`chat/${chatId}/edit/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      is_voice: false,
    }),
  });
}

export async function deleteConversation(conversationId) {
  return request(`conversation/${conversationId}/delete/`, {
    method: 'DELETE',
  });
}

export async function uploadReport(file, conversationId, preferredLanguage = '') {
  const normalizedFile = {
    uri: file?.uri,
    name: file?.name || `report-${Date.now()}.pdf`,
    type: file?.type || 'application/octet-stream',
  };

  const formData = new FormData();
  formData.append('file', normalizedFile);
  if (conversationId) {
    formData.append('conversation_id', String(conversationId));
  }
  if (preferredLanguage && preferredLanguage !== 'auto') {
    formData.append('preferred_language', preferredLanguage);
  }

  return request('upload-report/', {
    method: 'POST',
    body: formData,
  });
}
