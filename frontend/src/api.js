const DEFAULT_BASE_URL = "http://127.0.0.1:8000/api/";
const ENV_BASE_URL = (process.env.REACT_APP_API_BASE_URL || "").trim();
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function resolveBaseUrl() {
  const configured = ENV_BASE_URL || DEFAULT_BASE_URL;
  const browserHostname =
    typeof window !== "undefined" ? window.location.hostname : "";

  try {
    const url = new URL(configured);
    // If frontend is opened from another device, replace localhost API host with
    // the current page host so requests go to the same machine.
    if (
      browserHostname &&
      LOCAL_HOSTS.has(url.hostname) &&
      !LOCAL_HOSTS.has(browserHostname)
    ) {
      url.hostname = browserHostname;
    }
    return url.toString().replace(/\/?$/, "/");
  } catch (error) {
    return configured.replace(/\/?$/, "/");
  }
}

const BASE_URL = resolveBaseUrl();

const ACCESS_KEY = "mediassist_access_token";
const REFRESH_KEY = "mediassist_refresh_token";

function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

function setAuthTokens(access, refresh) {
  if (access) localStorage.setItem(ACCESS_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearAuthTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

async function request(path, options = {}, requireAuth = true) {
  const headers = { ...(options.headers || {}) };
  if (requireAuth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(BASE_URL + path, {
      ...options,
      headers,
    });
  } catch (error) {
    throw new Error(
      `Network error: unable to reach API at ${BASE_URL}. Check backend server and REACT_APP_API_BASE_URL.`
    );
  }

  const contentType = response.headers.get("content-type") || "";
  const rawText = await response.text();
  let data = null;
  if (contentType.includes("application/json")) {
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch (error) {
      data = null;
    }
  }

  if (!response.ok) {
    const error =
      data?.error ||
      data?.detail ||
      (rawText && rawText.startsWith("<!DOCTYPE") ? "Server returned HTML error page. Check backend logs/migrations." : rawText) ||
      "Request failed";
    throw new Error(error);
  }
  return data || {};
}

export async function signup(username, email, password) {
  const data = await request(
    "auth/signup/",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    },
    false
  );
  setAuthTokens(data.access, data.refresh);
  return data.user;
}

export async function login(username, password) {
  const data = await request(
    "auth/login/",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    },
    false
  );
  setAuthTokens(data.access, data.refresh);
  return data.user;
}

export async function googleLogin(idToken) {
  const data = await request(
    "auth/google-login/",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_token: idToken }),
    },
    false
  );
  setAuthTokens(data.access, data.refresh);
  return data.user;
}

export async function getCurrentUser() {
  return request("auth/me/");
}

export async function updateCurrentUser(profile) {
  return request("auth/me/", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
}

export async function sendMessage(
  message,
  conversationId,
  isVoice = false,
  preferredLanguage = ""
) {
  return request("chat/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: message,
      conversation_id: conversationId,
      is_voice: isVoice,
      preferred_language: preferredLanguage && preferredLanguage !== "auto" ? preferredLanguage : "",
    }),
  });
}

export async function getConversation(id) {
  return request(`conversation/${id}/`);
}

export async function getConversations() {
  return request("conversations/");
}

export async function editChatMessage(chatId, message, isVoice = false) {
  return request(`chat/${chatId}/edit/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      is_voice: isVoice,
    }),
  });
}

export async function deleteConversation(id) {
  return request(`conversation/${id}/delete/`, {
    method: "DELETE",
  });
}

export async function uploadReport(file, conversationId, preferredLanguage = "") {
  const formData = new FormData();
  formData.append("file", file);
  if (conversationId) {
    formData.append("conversation_id", conversationId);
  }
  if (preferredLanguage && preferredLanguage !== "auto") {
    formData.append("preferred_language", preferredLanguage);
  }

  return request("upload-report/", {
    method: "POST",
    body: formData,
  });
}
