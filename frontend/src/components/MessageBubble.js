import React from "react";

function MessageBubble({ text, type }) {
  return (
    <div className={`message ${type}`}>
      {text}
    </div>
  );
}

export default MessageBubble;
