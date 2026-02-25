import React from "react";

const BOT_SECTION_PATTERNS = [
  /Disease\s*:/gi,
  /Possible Causes\s*:/gi,
  /Home Care Advice\s*:/gi,
  /When to Visit Doctor\s*:/gi,
  /बीमारी\s*:/g,
  /रोग\s*:/g,
  /संभावित कारण\s*:/g,
  /संभावित कारणों?\s*:/g,
  /घरेलू देखभाल सलाह\s*:/g,
  /डॉक्टर से मिलने का समय\s*:/g,
  /બીમારી\s*:/g,
  /રોગ\s*:/g,
  /સંભવિત કારણો?\s*:/g,
  /ઘરે દવાની સલાહ\s*:/g,
  /ડોક્ટર સાથે જવાની વાતો\s*:/g,
  /ડોક્ટરને મળવાનો સમય\s*:/g,
];

function formatBotSections(text) {
  let value = String(text || "").replace(/\r\n/g, "\n");

  BOT_SECTION_PATTERNS.forEach((pattern) => {
    value = value.replace(pattern, (match, offset) => {
      const normalized = match.replace(/\s*:\s*$/, ": ").trimEnd();
      return `${offset === 0 ? "" : "\n"}${normalized}`;
    });
  });

  return value.replace(/\n{2,}/g, "\n").trim();
}

function MessageBubble({ text, type }) {
  const displayText = type === "bot" ? formatBotSections(text) : text;

  return (
    <div className={`message ${type}`}>
      {displayText}
    </div>
  );
}

export default MessageBubble;
