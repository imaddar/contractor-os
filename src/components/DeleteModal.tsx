import React from "react";
import { Icon } from "./Icon";

interface DeleteModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  itemName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string | null;
}

const DeleteModal: React.FC<DeleteModalProps> = ({
  isOpen,
  title,
  message,
  itemName,
  onConfirm,
  onCancel,
  isLoading = false,
  error = null,
}) => {
  console.log("DeleteModal render:", {
    isOpen,
    title,
    itemName,
    isLoading,
    error,
  });

  if (!isOpen) return null;

  const handleConfirm = () => {
    console.log("Delete confirmed for:", itemName);
    onConfirm();
  };

  const handleCancel = () => {
    console.log("Delete cancelled for:", itemName);
    onCancel();
  };

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div
        className="modal-content delete-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button
            onClick={handleCancel}
            className="modal-close"
            aria-label="Close"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="modal-body">
          {error && (
            <div
              className="error-message"
              style={{ marginBottom: "var(--space-lg)" }}
            >
              {error}
            </div>
          )}
          <div className="delete-warning">
            <div className="warning-icon">
              <Icon name="warning" size={20} />
            </div>
            <div className="warning-content">
              <p>{message}</p>
              <p className="item-name">"{itemName}"</p>
              <p className="warning-note">This action cannot be undone.</p>
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button
            onClick={handleConfirm}
            className="btn btn-danger"
            disabled={isLoading}
          >
            {isLoading ? "Deleting..." : "Delete"}
          </button>
          <button
            onClick={handleCancel}
            className="btn btn-secondary"
            disabled={isLoading}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteModal;
