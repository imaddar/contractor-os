import React from "react";
import { Icon } from "./Icon";

interface AutoGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  isGenerating: boolean;
  thinkingText?: string;
  progress?: string;
}

const AutoGenerationModal: React.FC<AutoGenerationModalProps> = ({
  isOpen,
  onClose,
  isGenerating,
  thinkingText,
  progress,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content autogen-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>
            <span className="heading-icon">
              <Icon name="ai" size={18} />
            </span>
            AI Auto-Generation
          </h3>
          {!isGenerating && (
            <button
              onClick={onClose}
              className="modal-close"
              aria-label="Close"
            >
              <Icon name="close" size={18} />
            </button>
          )}
        </div>

        <div className="modal-body">
          {isGenerating ? (
            <div className="autogen-loading">
              <div className="loading-spinner">
                <Icon name="clock" size={32} />
              </div>
              <p className="loading-text">
                {progress || "Analyzing document and generating..."}
              </p>
              {thinkingText && (
                <div className="thinking-box">
                  <p className="thinking-label">
                    <Icon name="ai" size={14} /> AI is thinking:
                  </p>
                  <p className="thinking-text">{thinkingText}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="autogen-complete">
              <div className="success-icon">
                <Icon name="check" size={32} />
              </div>
              <p>Generation complete!</p>
            </div>
          )}
        </div>

        {!isGenerating && (
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AutoGenerationModal;
