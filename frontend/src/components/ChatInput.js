import React, { useEffect, useRef, useState } from "react";

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M21.44 11.05l-8.49 8.49a5.5 5.5 0 01-7.78-7.78l8.49-8.49a3.5 3.5 0 114.95 4.95l-8.49 8.49a1.5 1.5 0 01-2.12-2.12l7.43-7.43"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M12 15a3 3 0 003-3V7a3 3 0 10-6 0v5a3 3 0 003 3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M19 11a7 7 0 01-14 0M12 18v3M8 21h8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M11 5L6 9H3v6h3l5 4V5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M15.5 8.5a5 5 0 010 7M18 6a8.5 8.5 0 010 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChatInput({ onSend, onUpload, onComposeStart, onSpeakerToggle }) {
  const [input, setInput] = useState("");
  const [attachedFile, setAttachedFile] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [hasMicDraft, setHasMicDraft] = useState(false);
  const [speakEnabled, setSpeakEnabled] = useState(false);
  const [voiceLang, setVoiceLang] = useState("auto");
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const micActiveRef = useRef(false);
  const micBaseInputRef = useRef("");
  const micFinalTextRef = useRef("");

  const handleSend = async () => {
    const message = input.trim();
    const usedVoiceInput = hasMicDraft || micActiveRef.current;

    if (!message && !attachedFile) {
      setError("Please enter a message or attach a file before sending.");
      return;
    }

    setError("");
    if (onComposeStart) onComposeStart();

    try {
      if (attachedFile && onUpload) {
        await onUpload(attachedFile, { preferredLanguage: voiceLang });
        setAttachedFile(null);
      }

      if (message) {
        if (usedVoiceInput) {
          stopMic();
          micBaseInputRef.current = "";
          micFinalTextRef.current = "";
          setHasMicDraft(false);
        }
        setInput("");

        await onSend(message, {
          isVoice: speakEnabled || usedVoiceInput,
          preferredLanguage: voiceLang,
        });
        if (!usedVoiceInput) setHasMicDraft(false);
      }
    } catch (sendError) {
      setError(sendError?.message || "Failed to send. Please try again.");
    }
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      setAttachedFile(file);
      if (onComposeStart) onComposeStart();
      if (error) setError("");
    }
    e.target.value = "";
  };

  const clearAttachment = () => {
    setAttachedFile(null);
  };

  const stopMic = () => {
    micActiveRef.current = false;
    const active = recognitionRef.current;
    if (active) {
      try {
        active.onend = null;
        active.onerror = null;
        active.stop();
      } catch {
        // Ignore stop errors from stale recognizers.
      }
    }
    recognitionRef.current = null;
    setIsListening(false);
  };

  const resolveRecognitionLang = () => {
    if (voiceLang !== "auto") return voiceLang;
    const browserLang = (navigator.language || "en-US").toLowerCase();
    if (browserLang.startsWith("hi")) return "hi-IN";
    if (browserLang.startsWith("gu")) return "gu-IN";
    return "en-US";
  };

  const startMicSession = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Mic is not supported in this browser. Use Chrome or Edge.");
      micActiveRef.current = false;
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = resolveRecognitionLang();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
      if (error) setError("");
    };
    recognition.onend = () => {
      setIsListening(false);
      micActiveRef.current = false;
      recognitionRef.current = null;
    };
    recognition.onerror = (event) => {
      const code = String(event?.error || "");
      if (code === "not-allowed" || code === "service-not-allowed") {
        setError(
          "Microphone blocked. In Chrome: lock icon > Site settings > Microphone: Allow, then reload."
        );
        stopMic();
        return;
      }
      if (code === "network") {
        setError("Mic recognition network error. Check connection and try again.");
        stopMic();
        return;
      }
      if (code === "audio-capture") {
        setError("Microphone unavailable. Check your system mic settings and try again.");
        stopMic();
        return;
      }
      setError(`Microphone error: ${code || "unknown"}.`);
      stopMic();
    };
    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const chunk = event.results[i]?.[0]?.transcript?.trim();
        if (!chunk) continue;
        if (event.results[i].isFinal) {
          micFinalTextRef.current = `${micFinalTextRef.current} ${chunk}`.trim();
        } else {
          interim = `${interim} ${chunk}`.trim();
        }
      }

      const composed = [micBaseInputRef.current, micFinalTextRef.current, interim]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (!composed) return;
      setInput(composed);
      setHasMicDraft(true);
      if (onComposeStart) onComposeStart();
    };

    try {
      recognition.start();
    } catch {
      setIsListening(false);
      micActiveRef.current = false;
      recognitionRef.current = null;
    }
  };

  const isSecureMicContext = () => {
    if (typeof window === "undefined") return true;
    if (window.isSecureContext) return true;
    const host = window.location.hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  };

  const handleVoiceInput = async () => {
    if (micActiveRef.current) {
      stopMic();
      return;
    }

    if (!isSecureMicContext()) {
      setError("Mic works only on HTTPS (or localhost). Open the website over HTTPS.");
      return;
    }

    if (onComposeStart) onComposeStart();
    micBaseInputRef.current = input.trim();
    micFinalTextRef.current = "";
    setError("");
    micActiveRef.current = true;
    startMicSession();
  };

  useEffect(() => () => stopMic(), []);

  const handleSpeakerToggle = async () => {
    const next = !speakEnabled;
    setSpeakEnabled(next);
    if (!onSpeakerToggle) return;
    const ok = await onSpeakerToggle(next, voiceLang);
    if (next && ok === false) {
      setError("Speaker test failed. Check browser/system sound settings.");
    } else if (next && error) {
      setError("");
    }
  };

  return (
    <div className="chat-input">
      {attachedFile ? (
        <div className="chat-input-attachment-row">
          <div className="attached-file-pill" title={attachedFile.name}>
            <span>{attachedFile.name}</span>
            <button
              type="button"
              className="remove-attachment-btn"
              onClick={clearAttachment}
              aria-label="Remove attached file"
              title="Remove attached file"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}

      <div className="chat-input-main">
        <button 
          className="upload-btn" 
          title="Upload File"
          aria-label="Upload File"
          onClick={handleUploadClick}
        >
          <UploadIcon />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.bmp,.tif,.tiff,.webp,image/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        <button 
          className="voice-btn" 
          title="Voice Input"
          aria-label="Voice Input"
          onClick={handleVoiceInput}
        >
          {isListening ? "■" : <MicIcon />}
        </button>

        <button
          className={`speak-btn ${speakEnabled ? "active" : ""}`}
          title="Speak bot reply for typed messages"
          aria-label="Speak bot reply for typed messages"
          onClick={handleSpeakerToggle}
        >
          <SpeakerIcon />
        </button>

        <select
          value={voiceLang}
          onChange={(e) => setVoiceLang(e.target.value)}
          title="Voice input language"
          aria-label="Voice input language"
        >
          <option value="auto">Auto</option>
          <option value="en-US">English</option>
          <option value="hi-IN">Hindi</option>
          <option value="gu-IN">Gujarati</option>
        </select>

        <input
          type="text"
          value={input}
          placeholder="Send a message..."
          onChange={(e) => {
            setInput(e.target.value);
            if (!isListening) setHasMicDraft(false);
            if (e.target.value && onComposeStart) onComposeStart();
            if (error) setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />

        <button className="send-btn" onClick={handleSend}>
          Send
        </button>
      </div>

      {error ? <div className="chat-input-error">{error}</div> : null}
    </div>
  );
}

export default ChatInput;
