import React, { useState } from "react";

function Sidebar({
  conversations,
  activeConversation,
  setActiveConversation,
  createNewChat,
  onDeleteConversation,
  onNavigate,
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const handleOpenConversation = (id) => {
    setActiveConversation(id);
    setConfirmDeleteId(null);
    if (onNavigate) onNavigate();
  };

  const handleDeleteClick = (e, id) => {
    e.stopPropagation();
    setConfirmDeleteId(id);
  };

  const handleCancelDelete = (e) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
  };

  const handleConfirmDelete = async (e, id) => {
    e.stopPropagation();
    await onDeleteConversation(id);
    setConfirmDeleteId(null);
    if (onNavigate) onNavigate();
  };

  return (
    <div className="sidebar">
      <button
        className="new-chat-btn"
        onClick={() => {
          createNewChat();
          if (onNavigate) onNavigate();
        }}
      >
        + New Chat
      </button>

      {conversations.map((conv) => {
        const isActive = activeConversation === conv.id;
        const isConfirmingDelete = confirmDeleteId === conv.id;

        return (
          <div
            key={conv.id}
            className={`conversation-item ${isActive ? "active" : ""}`}
            onClick={() => handleOpenConversation(conv.id)}
            title={conv.first_message || `Conversation ${conv.id}`}
          >
            <div className="conversation-header">
              <span className="conversation-title">
                {conv.first_message
                  ? conv.first_message.substring(0, 25)
                  : `Conversation ${conv.id}`}
              </span>

              {isActive && !isConfirmingDelete ? (
                <button
                  className="conversation-delete-btn"
                  onClick={(e) => handleDeleteClick(e, conv.id)}
                >
                  Delete
                </button>
              ) : null}
            </div>

            {isConfirmingDelete ? (
              <div className="conversation-delete-actions">
                <button
                  className="confirm-delete-btn"
                  onClick={(e) => handleConfirmDelete(e, conv.id)}
                >
                  Delete
                </button>
                <button
                  className="cancel-delete-btn"
                  onClick={handleCancelDelete}
                >
                  Cancel
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default Sidebar;
