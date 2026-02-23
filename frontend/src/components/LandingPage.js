import React, { useEffect, useState } from "react";

const ABOUT_ITEMS = [
  {
    title: "AI Symptom Matching",
    text: "Fast symptom-to-condition mapping using structured healthcare FAQ intelligence.",
    icon: "🧠",
  },
  {
    title: "Prescription Analysis",
    text: "Extracts report and prescription insights with clear recommendations and alerts.",
    icon: "💊",
  },
  {
    title: "Multilingual Chat",
    text: "Natural support across English, Hindi, and Gujarati with consistent guidance.",
    icon: "🌐",
  },
  {
    title: "Voice Assistant",
    text: "Voice-enabled healthcare interaction for faster and more accessible support.",
    icon: "🎙️",
  },
];

const HELP_ITEMS = [
  {
    title: "Symptom FAQ Matching",
    text: "Matches user symptoms against healthcare FAQ patterns to surface relevant conditions.",
    icon: "🩺",
  },
  {
    title: "Prescription Reading",
    text: "Parses medicine and care information from uploaded medical documents.",
    icon: "📄",
  },
  {
    title: "Report Upload Analysis",
    text: "Understands report content and returns practical care guidance and next steps.",
    icon: "📊",
  },
  {
    title: "Voice + Text Support",
    text: "Lets patients interact naturally with either voice or text-based chat.",
    icon: "💬",
  },
  {
    title: "Multilingual Responses",
    text: "Returns consistent answers in preferred language without losing medical context.",
    icon: "🗣️",
  },
  {
    title: "Secure Patient Data",
    text: "Built for privacy-first healthcare workflows and safe conversation history.",
    icon: "🔒",
  },
];

const TRUST_ITEMS = [
  "HIPAA-style privacy mindset",
  "Multilingual care support",
  "Responsible AI guidance",
];

const AUDIENCE_ITEMS = [
  "For Patients: faster first-step clarity for symptoms, medicines, and reports.",
  "For Clinics: streamlined triage support and multilingual patient communication.",
  "For Teams: consistent healthcare responses with safety-first design controls.",
];

const SECTION_IDS = ["home", "about", "how-it-helps"];

function LandingPage({ onLoginClick, onSignupClick }) {
  const [activeTab, setActiveTab] = useState("home");

  useEffect(() => {
    const sections = SECTION_IDS
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    if (!sections.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible[0]?.target?.id) {
          setActiveTab(visible[0].target.id);
        }
      },
      {
        root: null,
        threshold: [0.2, 0.45, 0.7],
        rootMargin: "-120px 0px -40% 0px",
      }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const handleTab = (tabId) => {
    setActiveTab(tabId);
    const el = document.getElementById(tabId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="landing-page relative min-h-screen w-full overflow-x-hidden bg-[radial-gradient(circle_at_12%_18%,#7dd3fc_0%,#2563eb_22%,#0b1f63_48%,#020617_100%)] text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-24 h-80 w-80 rounded-full bg-cyan-300/35 blur-3xl" />
        <div className="absolute right-0 top-[28%] h-[28rem] w-[28rem] rounded-full bg-brand-400/30 blur-3xl" />
        <div className="absolute bottom-[-120px] left-1/3 h-72 w-72 rounded-full bg-indigo-400/35 blur-3xl" />
      </div>

      <header className="fixed inset-x-0 top-0 z-[80] border-b border-white/20 bg-gradient-to-r from-slate-950/95 via-brand-900/95 to-slate-950/95 shadow-[0_10px_40px_rgba(8,15,45,0.45)] backdrop-blur-xl">
        <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-6 lg:px-10">
          <button
            type="button"
            onClick={() => handleTab("home")}
            className="group flex items-center gap-3"
            title="MediAssist AI Home"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-300/30 to-brand-500/30 shadow-glass transition group-hover:scale-105">
              <svg viewBox="0 0 48 48" className="h-7 w-7" aria-hidden="true">
                <circle cx="24" cy="24" r="22" fill="#2d7eff" />
                <path d="M24 12v24M12 24h24" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </span>
            <span className="text-left">
              <span className="block text-xl font-bold tracking-tight">MediAssist AI</span>
              <span className="block text-xs text-brand-100/80">Healthcare SaaS Platform</span>
            </span>
          </button>

          <nav className="hidden items-center gap-2 text-sm font-semibold md:flex">
            <button
              onClick={() => handleTab("home")}
              className={`rounded-full px-4 py-2 transition ${
                activeTab === "home"
                  ? "bg-gradient-to-r from-cyan-400 to-brand-500 text-white shadow-glass ring-2 ring-cyan-200/55 ring-offset-1 ring-offset-brand-900"
                  : "text-brand-100/90 hover:bg-white/10"
              }`}
            >
              Home
            </button>
            <button
              onClick={() => handleTab("about")}
              className={`rounded-full px-4 py-2 transition ${
                activeTab === "about"
                  ? "bg-gradient-to-r from-cyan-400 to-brand-500 text-white shadow-glass ring-2 ring-cyan-200/55 ring-offset-1 ring-offset-brand-900"
                  : "text-brand-100/90 hover:bg-white/10"
              }`}
            >
              About Us
            </button>
            <button
              onClick={() => handleTab("how-it-helps")}
              className={`rounded-full px-4 py-2 transition ${
                activeTab === "how-it-helps"
                  ? "bg-gradient-to-r from-cyan-400 to-brand-500 text-white shadow-glass ring-2 ring-cyan-200/55 ring-offset-1 ring-offset-brand-900"
                  : "text-brand-100/90 hover:bg-white/10"
              }`}
            >
              How It Helps
            </button>
            <button
              onClick={onLoginClick}
              className="rounded-full px-4 py-2 text-brand-100 transition hover:bg-white/10"
            >
              Login
            </button>
            <button
              onClick={onSignupClick}
              className="rounded-full bg-white px-5 py-2 text-brand-700 transition hover:scale-[1.04] hover:shadow-glass"
            >
              Sign Up
            </button>
          </nav>
        </div>
      </header>
      <div className="h-20" />

      <section id="home" className="relative min-h-screen w-full scroll-mt-28 px-6 pb-16 pt-16 lg:px-10">
        <div className="mx-auto grid h-full w-full max-w-7xl items-center gap-14 lg:grid-cols-2">
          <div className="hero-text-wrap relative z-10">
            <p className="mb-4 inline-flex rounded-full border border-cyan-200/45 bg-cyan-200/25 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-50">
              AI-Powered Healthcare
            </p>
            <h1 className="hero-heading max-w-xl text-4xl font-extrabold leading-tight md:text-6xl">
              Smart AI Health Companion
            </h1>
            <p className="hero-subtext mt-5 max-w-xl text-lg text-slate-200 md:text-xl">
              Instant symptom guidance, prescription insights & multilingual voice support.
            </p>

            <div className="mt-9 flex flex-wrap gap-4">
              <button
                onClick={onLoginClick}
                className="hero-cta-primary rounded-xl bg-gradient-to-r from-cyan-400 via-brand-500 to-indigo-500 px-8 py-3 text-base font-semibold text-white shadow-[0_8px_24px_rgba(45,126,255,0.45)] transition duration-200 ease-out hover:-translate-y-0.5 hover:from-cyan-300 hover:to-indigo-400"
              >
                Get Started
              </button>
              <button
                onClick={() => handleTab("how-it-helps")}
                className="rounded-xl border border-cyan-100/60 bg-white/5 px-8 py-3 text-base font-semibold text-cyan-100 transition duration-200 ease-out hover:bg-white/15"
              >
                Learn More
              </button>
            </div>

            <div className="mt-7 grid max-w-xl gap-3 sm:grid-cols-3">
              {TRUST_ITEMS.map((item) => (
                <div
                  key={item}
                  className="trust-badge rounded-2xl border border-cyan-100/45 bg-slate-950/55 px-3 py-2 text-center text-xs font-semibold text-white shadow-[0_8px_20px_rgba(7,18,48,0.35)] backdrop-blur"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="relative animate-[heroFloat_7s_ease-in-out_infinite]">
            <div className="absolute -left-8 -top-8 h-24 w-24 rounded-full bg-cyan-300/40 blur-xl" />
            <div className="absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-brand-300/30 blur-xl" />
            <div className="relative rounded-2xl border border-cyan-100/20 bg-gradient-to-b from-brand-900/65 to-slate-950/65 p-6 shadow-[0_20px_55px_rgba(11,28,88,0.55)] backdrop-blur">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-cyan-200/30 bg-white/10 p-4 transition duration-300 hover:-translate-y-1 hover:shadow-glass">
                  <p className="text-xs uppercase tracking-wider text-brand-100/80">Patient App</p>
                  <div className="mt-3 h-40 rounded-xl bg-gradient-to-br from-cyan-200/35 to-brand-500/25 p-3">
                    <div className="mb-2 h-3 w-24 rounded-full bg-white/70" />
                    <div className="mb-2 h-3 w-20 rounded-full bg-white/40" />
                    <div className="h-20 rounded-lg border border-brand-100/25 bg-white/20" />
                  </div>
                </div>
                <div className="rounded-2xl border border-brand-200/30 bg-white/10 p-4 transition duration-300 hover:-translate-y-1 hover:shadow-glass">
                  <p className="text-xs uppercase tracking-wider text-brand-100/80">AI Assistant</p>
                  <div className="mt-3 flex h-40 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-300/30 to-brand-700/30">
                    <svg viewBox="0 0 128 128" className="h-24 w-24" aria-hidden="true">
                      <rect x="28" y="36" width="72" height="56" rx="14" fill="#9dd2ff" />
                      <circle cx="52" cy="63" r="6" fill="#0f2f61" />
                      <circle cx="76" cy="63" r="6" fill="#0f2f61" />
                      <path d="M50 78c5 5 23 5 28 0" stroke="#0f2f61" strokeWidth="4" fill="none" />
                      <rect x="58" y="18" width="12" height="18" rx="5" fill="#54a2ff" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="mt-5 rounded-2xl border border-brand-200/30 bg-white/10 p-4 text-sm text-brand-100/90">
                Real-time support for symptoms, prescriptions, reports, and multilingual care guidance.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="mx-auto w-full max-w-7xl scroll-mt-28 px-6 py-24 lg:px-10">
        <div className="mb-12 max-w-3xl">
          <h2 className="bg-gradient-to-r from-white to-cyan-200 bg-clip-text text-3xl font-bold text-transparent md:text-4xl">
            About Us
          </h2>
          <p className="mt-3 leading-[1.68] text-brand-100/85">
            MediAssist AI is designed to help patients get clearer first-step guidance through
            healthcare-focused AI workflows.
          </p>
          <p className="mt-5 rounded-2xl border border-cyan-100/38 bg-slate-950/42 p-5 leading-[1.68] text-brand-100/92">
            <span className="font-semibold text-white">Our mission:</span> deliver accessible,
            trustworthy, and responsible AI support so patients can make better healthcare decisions
            earlier, with confidence and transparency.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {ABOUT_ITEMS.map((item) => (
            <article
              key={item.title}
              className="group rounded-2xl border border-white/24 bg-gradient-to-b from-white/12 to-white/[0.06] p-6 backdrop-blur transition duration-300 hover:-translate-y-[4px] hover:border-cyan-200/52 hover:shadow-[0_16px_36px_rgba(8,21,58,0.38)]"
            >
              <div className="mb-4 text-3xl">{item.icon}</div>
              <h3 className="text-xl font-semibold">{item.title}</h3>
              <p className="mt-2 leading-[1.68] text-brand-100/85">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-helps" className="mx-auto w-full max-w-7xl scroll-mt-28 px-6 pb-24 pt-14 lg:px-10">
        <div className="mb-10 max-w-2xl">
          <h2 className="bg-gradient-to-r from-white to-cyan-200 bg-clip-text text-3xl font-bold text-transparent md:text-4xl">
            How It Helps
          </h2>
          <p className="mt-3 text-brand-100/85">
            Purpose-built healthcare blocks for patient support, clarity, and safer follow-up.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {HELP_ITEMS.map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-white/15 bg-gradient-to-br from-slate-950/35 to-brand-900/25 p-6 transition duration-200 ease-out hover:-translate-y-[4px] hover:scale-[1.01] hover:border-cyan-200/45 hover:bg-slate-900/60 hover:shadow-[0_14px_34px_rgba(10,22,58,0.36)]"
            >
              <div className="mb-4 text-2xl">{item.icon}</div>
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-[1.66] text-brand-100/80">{item.text}</p>
            </article>
          ))}
        </div>

        <div className="mt-10 rounded-3xl border border-cyan-100/20 bg-slate-950/35 p-6 backdrop-blur">
          <h3 className="text-xl font-semibold text-white">Who This Helps Most</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {AUDIENCE_ITEMS.map((item) => (
              <div
                key={item}
              className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-brand-100/90 transition duration-300 hover:-translate-y-1 hover:border-cyan-200/45"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/15 bg-slate-950/55">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-8 text-sm text-brand-100/90 lg:px-10 md:flex-row md:items-center md:justify-between">
          <div className="font-medium text-white">MediAssist AI</div>
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" className="transition hover:text-white">Privacy</button>
            <button type="button" className="transition hover:text-white">Terms</button>
            <button type="button" className="transition hover:text-white">Contact</button>
          </div>
          <div className="max-w-md text-xs text-brand-100/80">
            Emergency disclaimer: MediAssist AI does not replace clinical diagnosis. In urgent situations, contact your nearest hospital or emergency services immediately.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
