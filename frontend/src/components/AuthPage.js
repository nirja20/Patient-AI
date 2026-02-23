import React, { useEffect, useRef, useState } from "react";
import { googleLogin, login, signup } from "../api";

function AuthPage({ onAuthSuccess, initialMode = "login", onBack }) {
  const [mode, setMode] = useState(initialMode === "signup" ? "signup" : "login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const googleBtnRef = useRef(null);
  const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";

  useEffect(() => {
    if (!googleClientId) return;

    const setupGoogle = () => {
      if (!window.google?.accounts?.id || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          setError("");
          setLoading(true);
          try {
            const user = await googleLogin(response.credential);
            onAuthSuccess(user);
          } catch (err) {
            setError(err.message || "Google sign-in failed.");
          } finally {
            setLoading(false);
          }
        },
      });

      googleBtnRef.current.innerHTML = "";
      const buttonWidth = Math.floor(googleBtnRef.current.getBoundingClientRect().width);
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
        width: buttonWidth > 0 ? buttonWidth : 360,
      });
      setGoogleReady(true);
    };

    if (window.google?.accounts?.id) {
      setupGoogle();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = setupGoogle;
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [googleClientId, onAuthSuccess]);

  useEffect(() => {
    setMode(initialMode === "signup" ? "signup" : "login");
  }, [initialMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user =
        mode === "signup"
          ? await signup(username.trim(), email.trim(), password)
          : await login(username.trim(), password);
      onAuthSuccess(user);
    } catch (err) {
      setError(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-brand-300 via-brand-900 to-slate-950 p-4 text-slate-100 md:p-8">
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.45)_1px,transparent_1px)] [background-size:26px_26px]" />
      <div className="animate-[authFadeIn_420ms_ease-out] mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-7xl overflow-hidden rounded-[2rem] border border-white/20 bg-slate-900/45 shadow-[0_26px_74px_rgba(8,16,45,0.47)] backdrop-blur-xl md:min-h-[calc(100vh-4rem)]">
        <aside className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-brand-500 via-brand-700 to-brand-900 p-12 lg:block">
          <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-cyan-200/25 blur-2xl" />
          <div className="absolute -bottom-12 -left-12 h-56 w-56 rounded-full bg-brand-200/20 blur-2xl" />
          <div className="relative z-10">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100/90">
              AI Healthcare Assistant
            </p>
            <h2 className="max-w-md bg-gradient-to-r from-white to-cyan-100 bg-clip-text text-4xl font-bold leading-tight text-transparent">
              Your trusted digital companion for symptom and report guidance.
            </h2>
            <p className="mt-4 max-w-md text-brand-100/90">
              Voice-enabled, multilingual, and built for modern patient support experiences.
            </p>
          </div>

          <div className="relative z-10 mt-12 rounded-3xl border border-cyan-100/25 bg-white/10 p-6 shadow-glass">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-900/30 p-4">
                <p className="text-xs uppercase tracking-wide text-brand-100/80">Patient Chat</p>
                <div className="mt-3 space-y-2">
                  <div className="h-3 w-24 rounded-full bg-white/50" />
                  <div className="h-3 w-20 rounded-full bg-white/30" />
                  <div className="h-3 w-16 rounded-full bg-white/20" />
                </div>
              </div>
              <div className="flex items-center justify-center rounded-2xl bg-slate-900/30 p-4">
                <svg viewBox="0 0 128 128" className="h-20 w-20" aria-hidden="true">
                  <rect x="28" y="36" width="72" height="56" rx="14" fill="#9dd2ff" />
                  <circle cx="52" cy="63" r="6" fill="#0f2f61" />
                  <circle cx="76" cy="63" r="6" fill="#0f2f61" />
                  <path d="M50 78c5 5 23 5 28 0" stroke="#0f2f61" strokeWidth="4" fill="none" />
                  <rect x="58" y="18" width="12" height="18" rx="5" fill="#54a2ff" />
                </svg>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex w-full items-center justify-center p-6 md:p-10 lg:w-1/2">
          <div className="w-full max-w-md">
            {onBack ? (
              <button
                type="button"
                className="mb-6 rounded-2xl border border-white/30 px-4 py-2 text-sm transition hover:bg-white/10"
                onClick={onBack}
              >
                ← Back
              </button>
            ) : null}

            <div className="rounded-2xl border border-white/20 bg-slate-950/45 p-6 shadow-glass md:p-8">
              <h1 className="text-3xl font-bold text-[#F1F5F9]">Welcome to MediAssist AI</h1>
              <p className="mt-2 text-brand-100/85">
                Login or sign up to continue to your chat assistant.
              </p>

              <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-slate-100 outline-none placeholder:text-white/72 transition-all duration-200 ease-out focus:-translate-y-[1px] focus:border-cyan-200 focus:ring-2 focus:ring-cyan-300/35 focus:shadow-[0_8px_22px_rgba(64,158,255,0.18)]"
                />

                {mode === "signup" ? (
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-slate-100 outline-none placeholder:text-white/72 transition-all duration-200 ease-out focus:-translate-y-[1px] focus:border-cyan-200 focus:ring-2 focus:ring-cyan-300/35 focus:shadow-[0_8px_22px_rgba(64,158,255,0.18)]"
                  />
                ) : null}

                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-slate-100 outline-none placeholder:text-white/72 transition-all duration-200 ease-out focus:-translate-y-[1px] focus:border-cyan-200 focus:ring-2 focus:ring-cyan-300/35 focus:shadow-[0_8px_22px_rgba(64,158,255,0.18)]"
                />

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 via-brand-500 to-indigo-500 px-4 py-3 text-base font-semibold text-white shadow-[0_10px_26px_rgba(45,126,255,0.38)] transition-all duration-200 ease-out hover:from-cyan-300 hover:to-indigo-400 hover:shadow-[0_14px_34px_rgba(48,138,255,0.52)] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? "Please wait..." : mode === "signup" ? "Sign Up" : "Login"}
                </button>
              </form>

              <div className="mt-4 min-h-[54px]">
                <div ref={googleBtnRef} className="overflow-hidden rounded-xl" />
                {!googleClientId ? (
                  <div className="mt-2 text-sm text-red-300">
                    Google OAuth not configured in frontend.
                  </div>
                ) : null}
                {googleClientId && !googleReady ? (
                  <div className="mt-2 text-sm text-brand-100/80">Loading Google sign-in...</div>
                ) : null}
              </div>

              <div className="mt-5 text-sm text-brand-100">
                {mode === "signup" ? "Already have an account?" : "New user?"}{" "}
                <button
                  type="button"
                  onClick={() => setMode((prev) => (prev === "signup" ? "login" : "signup"))}
                  className="font-semibold text-cyan-200 transition hover:text-white"
                >
                  {mode === "signup" ? "Login" : "Create account"}
                </button>
              </div>

              {error ? <div className="mt-4 text-sm text-red-300">{error}</div> : null}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default AuthPage;
