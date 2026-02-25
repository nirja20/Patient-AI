import React, { useEffect, useRef, useState } from "react";
import {
  sendMessage,
  getConversation,
  getConversations,
  uploadReport,
  editChatMessage,
} from "../api";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";

function ChatWindow({ activeConversation, refreshConversations }) {
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(activeConversation);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [hasStartedComposing, setHasStartedComposing] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editedText, setEditedText] = useState("");
  const lastBotReplyRef = useRef("");

  useEffect(() => {
    loadSuggestedQuestions();
  }, []);

  useEffect(() => {
    if (activeConversation) {
      loadConversation(activeConversation);
      setConversationId(activeConversation);
      setHasStartedComposing(false);
    } else {
      setMessages([]);
      setConversationId(null);
      setHasStartedComposing(false);
    }
  }, [activeConversation]);

  const normalizeQuestion = (text) =>
    (text || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");

  const STOP_WORDS = new Set([
    "i",
    "have",
    "am",
    "is",
    "are",
    "the",
    "a",
    "an",
    "and",
    "or",
    "to",
    "of",
    "my",
    "me",
    "it",
    "for",
    "with",
    "in",
  ]);

  const stemToken = (token) => {
    let value = token;
    for (const suffix of ["ing", "edly", "ed", "ly", "es", "s"]) {
      if (value.endsWith(suffix) && value.length > suffix.length + 2) {
        value = value.slice(0, -suffix.length);
        break;
      }
    }
    return value;
  };

  const questionTokenSet = (text) => {
    const normalized = normalizeQuestion(text);
    const rawTokens = normalized.match(/[a-z0-9]+/g) || [];
    return new Set(
      rawTokens
        .map(stemToken)
        .filter((token) => token && token.length > 2 && !STOP_WORDS.has(token))
    );
  };

  const jaccardSimilarity = (aSet, bSet) => {
    if (!aSet.size || !bSet.size) return 0;
    let intersection = 0;
    for (const token of aSet) {
      if (bSet.has(token)) intersection += 1;
    }
    const union = aSet.size + bSet.size - intersection;
    return union ? intersection / union : 0;
  };

  const loadSuggestedQuestions = async () => {
    const fallback = [
      "I have fever and body pain",
      "I have weight change and hair fall",
      "I have cough and sore throat",
      "I feel rapid heartbeat",
    ];

    try {
      const conversations = await getConversations();
      const limited = (conversations || []).slice(0, 40);
      const histories = await Promise.all(
        limited.map((conv) => getConversation(conv.id).catch(() => []))
      );

      const groups = [];
      histories.flat().forEach((item) => {
        const question = (item?.message || "").trim();
        if (!question || question.startsWith("[Uploaded File]")) return;
        const tokens = questionTokenSet(question);
        if (!tokens.size) return;

        let bestIndex = -1;
        let bestScore = 0;
        for (let i = 0; i < groups.length; i += 1) {
          const score = jaccardSimilarity(tokens, groups[i].tokens);
          if (score > bestScore) {
            bestScore = score;
            bestIndex = i;
          }
        }

        if (bestIndex >= 0 && bestScore >= 0.55) {
          const current = groups[bestIndex];
          current.count += 1;
          // Keep clearer/longer phrasing as display text.
          if (question.length > current.text.length) {
            current.text = question;
            current.tokens = tokens;
          }
        } else {
          groups.push({ text: question, tokens, count: 1 });
        }
      });

      const top = groups
        .sort((a, b) => b.count - a.count)
        .slice(0, 4)
        .map((item) => item.text);

      setSuggestedQuestions(top.length > 0 ? top : fallback);
    } catch (error) {
      setSuggestedQuestions(fallback);
    }
  };

  const loadConversation = async (id) => {
    setIsLoadingConversation(true);
    try {
      const data = await getConversation(id);
      setMessages(data);
      if (Array.isArray(data) && data.length > 0) {
        const last = data[data.length - 1];
        lastBotReplyRef.current = last?.response || "";
      }
    } finally {
      setIsLoadingConversation(false);
    }
  };

  const playAudio = async (audioBase64) => {
    if (!audioBase64) return false;
    const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
    audio.muted = false;
    audio.volume = 1;
    try {
      await audio.play();
      return true;
    } catch {
      return false;
    }
  };

  const speakFallback = (text, preferredLanguage = "auto") =>
    new Promise((resolve) => {
      if (!text || !window.speechSynthesis) {
        resolve(false);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      if (preferredLanguage && preferredLanguage !== "auto") {
        utterance.lang = preferredLanguage;
      } else {
        const browserLang = (navigator.language || "en-US").toLowerCase();
        utterance.lang = browserLang.startsWith("hi")
          ? "hi-IN"
          : browserLang.startsWith("gu")
            ? "gu-IN"
            : "en-US";
      }
      const voices = window.speechSynthesis.getVoices();
      const langPrefix = utterance.lang.toLowerCase().split("-")[0];
      const matchedVoice = voices.find((voice) =>
        (voice.lang || "").toLowerCase().startsWith(langPrefix)
      );
      if (matchedVoice) utterance.voice = matchedVoice;
      window.speechSynthesis.cancel();
      let settled = false;
      const timeoutMs = Math.min(45000, Math.max(12000, text.length * 110));
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        resolve(ok);
      };
      utterance.onend = () => finish(true);
      utterance.onerror = () => finish(false);
      window.speechSynthesis.speak(utterance);
      const timeoutId = setTimeout(() => finish(false), timeoutMs);
    });

  const speakWithFallback = async (text, audioBase64, preferredLanguage = "auto") => {
    if (!text && !audioBase64) return false;
    const hasBrowserTts =
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      typeof window.SpeechSynthesisUtterance !== "undefined";

    if (hasBrowserTts && text) {
      const spoken = await speakFallback(text, preferredLanguage);
      if (spoken) return true;
    }

    if (audioBase64) {
      return playAudio(audioBase64);
    }
    return false;
  };

  const handleSend = async (text, options = {}) => {
    setHasStartedComposing(true);
    const data = await sendMessage(
      text,
      conversationId,
      !!options.isVoice,
      options.preferredLanguage || ""
    );

    if (!conversationId) {
      setConversationId(data.conversation_id);
      refreshConversations();
    }

    setMessages((prev) => [
      ...prev,
      { id: data.chat_id, message: text, response: data.response },
    ]);
    lastBotReplyRef.current = data.response || "";

    if (options.isVoice) {
      await speakWithFallback(
        data.response,
        data.audio_base64,
        options.preferredLanguage || "auto"
      );
    }

    loadSuggestedQuestions();
  };

  const handleUpload = async (file, options = {}) => {
    setHasStartedComposing(true);
    const data = await uploadReport(file, conversationId, options.preferredLanguage || "");
    const uploadMessage = `[Uploaded File] ${file.name}`;

    if (!conversationId && data.conversation_id) {
      setConversationId(data.conversation_id);
      refreshConversations();
    }

    setMessages((prev) => [
      ...prev,
      { message: uploadMessage, response: data.response },
    ]);
  };

  const handleSuggestionClick = async (question) => {
    setHasStartedComposing(true);
    await handleSend(question, { isVoice: false });
  };

  const startEditMessage = (msg) => {
    if (!msg?.id) return;
    setEditingMessageId(msg.id);
    setEditedText(msg.message || "");
  };

  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setEditedText("");
  };

  const saveEditedMessage = async (msg) => {
    const value = editedText.trim();
    if (!msg?.id || !value) return;

    const data = await editChatMessage(msg.id, value, false);
    setMessages((prev) => {
      const editIndex = prev.findIndex((item) => item.id === msg.id);
      if (editIndex === -1) return prev;

      const updated = [...prev];
      updated[editIndex] = {
        ...updated[editIndex],
        message: data.message || value,
        response: data.response || updated[editIndex].response,
      };

      // GPT-like branching: drop all messages after edited one.
      return updated.slice(0, editIndex + 1);
    });
    refreshConversations();
    cancelEditMessage();
    loadSuggestedQuestions();
  };

  return (
    <div className="chat-window">
      <div className="messages">
        {isLoadingConversation ? (
          <div className="chat-skeleton-wrap">
            <div className="chat-skeleton bubble-left" />
            <div className="chat-skeleton bubble-right" />
            <div className="chat-skeleton bubble-left long" />
            <div className="chat-skeleton bubble-right short" />
          </div>
        ) : null}

        {!isLoadingConversation && messages.length === 0 && !hasStartedComposing ? (
          <div className="chat-empty-state">
            <h2>Hello, how can I help you today?</h2>
            <p>Ask about symptoms, medicines, home care, or upload a report.</p>
            <div className="chat-suggestion-grid">
              {suggestedQuestions.slice(0, 4).map((question, index) => (
                <button
                  key={`${question}-${index}`}
                  className="chat-suggestion-card"
                  onClick={() => handleSuggestionClick(question)}
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {!isLoadingConversation &&
          messages.map((msg, index) => (
            <div key={msg.id || index}>
              <div className="user-message-row">
                {editingMessageId === msg.id ? (
                  <div className="message-edit-box">
                    <input
                      type="text"
                      value={editedText}
                      onChange={(e) => setEditedText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEditedMessage(msg);
                      }}
                    />
                    <button onClick={() => saveEditedMessage(msg)}>Resend</button>
                    <button onClick={cancelEditMessage}>Cancel</button>
                  </div>
                ) : (
                  <>
                    <MessageBubble text={msg.message} type="user" />
                    {msg.id ? (
                      <button
                        className="edit-message-btn"
                        title="Edit message"
                        onClick={() => startEditMessage(msg)}
                      >
                        ✎
                      </button>
                    ) : null}
                  </>
                )}
              </div>
              <MessageBubble text={msg.response} type="bot" />
            </div>
          ))}
      </div>
      <ChatInput
        onSend={handleSend}
        onUpload={handleUpload}
        onComposeStart={() => setHasStartedComposing(true)}
        onSpeakerToggle={async (enabled, preferredLanguage) => {
          if (!enabled) return true;
          const text = lastBotReplyRef.current || "Speaker is enabled.";
          return speakWithFallback(text, "", preferredLanguage || "auto");
        }}
      />
    </div>
  );
}

export default ChatWindow;
