import { Icon } from "./Icon";
import { useGenerationStatus } from "../context/GenerationStatusContext";

function GenerationStatusPanel() {
  const {
    state: {
      isVisible,
      isComplete,
      isMinimized,
      steps,
      thinkingFeed,
      error,
      success,
    },
    dismissPanel,
    toggleMinimized,
  } = useGenerationStatus();

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`generation-status-container ${
        isComplete ? "is-complete" : ""
      } ${isMinimized ? "is-minimized" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div
        className={`generation-status-panel ${
          isMinimized ? "is-minimized" : ""
        }`}
      >
        <div className="generation-status-header">
          <div className="generation-status-title">
            <span className="heading-icon">
              <Icon name="ai" size={18} />
            </span>
            <div>
              <h3>{isComplete ? "ConstructIQ finished" : "ConstructIQ is working"}</h3>
              <p className="generation-status-subtitle">
                {isComplete ? "Generation finished" : "Tasks are running in the background"}
              </p>
            </div>
          </div>
          <div className="generation-status-controls">
            {!isComplete && (
              <button
                onClick={toggleMinimized}
                className="btn btn-icon"
                aria-label={isMinimized ? "Expand progress" : "Minimize progress"}
                type="button"
              >
                <Icon name={isMinimized ? "arrow-left" : "arrow-right"} size={16} />
              </button>
            )}
            <span
              className={`generation-indicator ${
                isComplete ? "complete" : "active"
              }`}
              aria-hidden="true"
            />
            <button
              onClick={dismissPanel}
              className="btn btn-icon"
              aria-label="Close progress"
              disabled={!isComplete}
              title={
                isComplete ? "Dismiss status" : "Generation must finish before closing"
              }
              type="button"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            <div className="generation-status-body">
              <div className="progress-steps">
                {steps.map((step) => (
                  <div key={step.id} className={`progress-step ${step.status}`}>
                    <span className="step-indicator" />
                    <span className="step-label">{step.label}</span>
                  </div>
                ))}
              </div>

              <div className="thinking-feed">
                {thinkingFeed.map((line) => (
                  <div key={line.id} className="thinking-line">
                    {line.text}
                  </div>
                ))}
              </div>

              {isComplete && error && (
                <div className="error-message generation-status-message">{error}</div>
              )}
              {isComplete && success && (
                <div className="success-message generation-status-message">
                  {success}
                </div>
              )}
            </div>

            <div className="generation-status-footer">
              <button
                type="button"
                className="btn btn-primary"
                onClick={dismissPanel}
                disabled={!isComplete}
              >
                {isComplete ? "Dismiss" : "Working..."}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default GenerationStatusPanel;
