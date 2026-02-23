import React, { useEffect, useRef, useState } from "react";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import AuthPage from "./components/AuthPage";
import LandingPage from "./components/LandingPage";
import {
  getConversations,
  deleteConversation,
  getCurrentUser,
  updateCurrentUser,
  clearAuthTokens,
} from "./api";
import "./App.css";

function App() {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authView, setAuthView] = useState("landing");
  const [authMode, setAuthMode] = useState("login");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [theme, setTheme] = useState(localStorage.getItem("mediassist_theme") || "default");
  const [isCompactLayout, setIsCompactLayout] = useState(window.innerWidth < 900);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    username: "",
    email: "",
    dob: "",
    gender: "",
  });
  const profileMenuRef = useRef(null);
  const isAdminUser = user?.role === "admin" || (user?.username || "").toLowerCase() === "admin";

  useEffect(() => {
    bootstrapAuth();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const compact = window.innerWidth < 900;
      setIsCompactLayout(compact);
      if (!compact) setIsSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!isProfileOpen) return;
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isProfileOpen]);

  useEffect(() => {
    document.body.classList.remove("theme-default", "theme-light", "theme-dark");
    document.body.classList.add(`theme-${theme}`);
    localStorage.setItem("mediassist_theme", theme);
  }, [theme]);

  const bootstrapAuth = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setProfileForm({
        username: currentUser.username || "",
        email: currentUser.email || "",
        dob: currentUser.dob || "",
        gender: currentUser.gender || "",
      });
      await loadConversations();
    } catch (error) {
      clearAuthTokens();
      setUser(null);
    } finally {
      setAuthReady(true);
    }
  };

  const loadConversations = async () => {
    try {
      const data = await getConversations();
      setConversations(data);
    } catch (error) {
      setConversations([]);
    }
  };

  const createNewChat = () => {
    setActiveConversation(null); // backend creates new when sending first message
  };

  const handleDeleteConversation = async (conversationId) => {
    await deleteConversation(conversationId);
    if (activeConversation === conversationId) {
      setActiveConversation(null);
    }
    await loadConversations();
  };

  const handleAuthSuccess = async (authedUser) => {
    setUser(authedUser);
    setProfileForm({
      username: authedUser.username || "",
      email: authedUser.email || "",
      dob: authedUser.dob || "",
      gender: authedUser.gender || "",
    });
    setActiveConversation(null);
    await loadConversations();
  };

  const handleLogout = () => {
    clearAuthTokens();
    setUser(null);
    setConversations([]);
    setActiveConversation(null);
    setIsProfileOpen(false);
    setIsProfileModalOpen(false);
    setIsSettingsModalOpen(false);
    setAuthView("landing");
    setAuthMode("login");
  };

  const openProfileModal = () => {
    setProfileForm({
      username: user.username || "",
      email: user.email || "",
      dob: user.dob || "",
      gender: user.gender || "",
    });
    setProfileError("");
    setIsProfileModalOpen(true);
    setIsProfileOpen(false);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileError("");
    try {
      const updated = await updateCurrentUser(profileForm);
      setUser(updated);
      setIsProfileModalOpen(false);
      setToastMessage("Profile updated successfully.");
      setTimeout(() => setToastMessage(""), 2400);
    } catch (error) {
      setProfileError(error.message || "Failed to update profile.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (!authReady) {
    return <div className="auth-shell">Loading...</div>;
  }

  if (!user) {
    if (authView === "landing") {
      return (
        <LandingPage
          onLoginClick={() => {
            setAuthMode("login");
            setAuthView("auth");
          }}
          onSignupClick={() => {
            setAuthMode("signup");
            setAuthView("auth");
          }}
        />
      );
    }

    return (
      <AuthPage
        onAuthSuccess={handleAuthSuccess}
        initialMode={authMode}
        onBack={() => setAuthView("landing")}
      />
    );
  }

  return (
    <div className="app-shell">
      <header className="top-header">
        <div className="brand-wrap">
          {isCompactLayout ? (
            <button
              className="hamburger-btn"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open chat history"
              title="Open chat history"
            >
              ☰
            </button>
          ) : null}
          <div className="brand-logo" aria-hidden="true">
            <svg viewBox="0 0 48 48" width="28" height="28">
              <defs>
                <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#39b4ff" />
                  <stop offset="100%" stopColor="#1f6dff" />
                </linearGradient>
              </defs>
              <circle cx="24" cy="24" r="22" fill="url(#brandGrad)" />
              <path d="M24 12v24M12 24h24" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
              <path d="M24 8a16 16 0 0116 16" stroke="#9ed2ff" strokeWidth="2.5" fill="none" />
            </svg>
          </div>
          <div className="brand-text">
            <span className="brand-title">MediAssist AI</span>
            <span className="brand-subtitle">Smart Patient Companion</span>
          </div>
        </div>

        <div className="profile-placeholder" ref={profileMenuRef}>
          <button
            className="profile-trigger"
            title={user.email || user.username}
            onClick={() => setIsProfileOpen((prev) => !prev)}
          >
            <div className="profile-avatar">
              {(user.username || "U").charAt(0).toUpperCase()}
            </div>
            <span className="profile-name">{user.username}</span>
          </button>

          {isProfileOpen ? (
            <div className="profile-dropdown">
              <div className="profile-email">{user.email}</div>
              {isAdminUser ? (
                <button
                  className="profile-dropdown-btn"
                  onClick={() => {
                    setIsSettingsModalOpen(true);
                    setIsProfileOpen(false);
                  }}
                >
                  Settings
                </button>
              ) : null}
              <button className="profile-dropdown-btn" onClick={openProfileModal}>
                Profile
              </button>
              <button className="logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <div className={`app ${isCompactLayout ? "compact-layout" : ""}`}>
        {isCompactLayout ? (
          <>
            <div
              className={`sidebar-overlay ${isSidebarOpen ? "open" : ""}`}
              onClick={() => setIsSidebarOpen(false)}
            />
            <aside className={`sidebar-drawer ${isSidebarOpen ? "open" : ""}`}>
              <Sidebar
                conversations={conversations}
                activeConversation={activeConversation}
                setActiveConversation={setActiveConversation}
                createNewChat={createNewChat}
                onDeleteConversation={handleDeleteConversation}
                onNavigate={() => setIsSidebarOpen(false)}
              />
            </aside>
          </>
        ) : (
          <Sidebar
            conversations={conversations}
            activeConversation={activeConversation}
            setActiveConversation={setActiveConversation}
            createNewChat={createNewChat}
            onDeleteConversation={handleDeleteConversation}
          />
        )}
        <ChatWindow
          activeConversation={activeConversation}
          refreshConversations={loadConversations}
        />
      </div>

      {isProfileModalOpen ? (
        <div className="profile-modal-overlay" onClick={() => setIsProfileModalOpen(false)}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <h3>User Profile</h3>
            <form onSubmit={handleSaveProfile} className="profile-form">
              <label>
                Username
                <input
                  type="text"
                  value={profileForm.username}
                  onChange={(e) =>
                    setProfileForm((prev) => ({ ...prev, username: e.target.value }))
                  }
                  required
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) =>
                    setProfileForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  required
                />
              </label>
              <label>
                DOB
                <input
                  type="date"
                  value={profileForm.dob || ""}
                  onChange={(e) =>
                    setProfileForm((prev) => ({ ...prev, dob: e.target.value }))
                  }
                />
              </label>
              <label>
                Gender
                <select
                  value={profileForm.gender || ""}
                  onChange={(e) =>
                    setProfileForm((prev) => ({ ...prev, gender: e.target.value }))
                  }
                >
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </label>

              {profileError ? <div className="profile-error">{profileError}</div> : null}

              <div className="profile-actions">
                <button
                  type="button"
                  className="profile-cancel-btn"
                  onClick={() => setIsProfileModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="profile-save-btn" disabled={isSavingProfile}>
                  {isSavingProfile ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isSettingsModalOpen ? (
        <div className="profile-modal-overlay" onClick={() => setIsSettingsModalOpen(false)}>
          <div className="profile-modal settings-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Theme Settings</h3>
            <div className="theme-card-grid">
              {[
                { id: "default", label: "Default Theme" },
                { id: "light", label: "Light Theme" },
                { id: "dark", label: "Dark Theme" },
              ].map((item) => (
                <div
                  key={item.id}
                  className={`theme-card ${theme === item.id ? "active" : ""}`}
                >
                  {theme === item.id ? <div className="theme-active-badge">Active</div> : null}
                  <div className={`theme-preview theme-preview-${item.id}`}>
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="theme-card-title">{item.label}</div>
                  <button
                    type="button"
                    className="profile-save-btn"
                    onClick={() => setTheme(item.id)}
                    disabled={theme === item.id}
                  >
                    {theme === item.id ? "Selected" : "Select"}
                  </button>
                </div>
              ))}
            </div>
            <div className="profile-actions">
              <button
                type="button"
                className="profile-cancel-btn"
                onClick={() => setIsSettingsModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toastMessage ? <div className="toast-success">{toastMessage}</div> : null}
    </div>
  );
}

export default App;
