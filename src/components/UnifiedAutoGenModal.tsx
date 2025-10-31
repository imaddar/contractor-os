import React, { useState } from "react";
import { Icon } from "./Icon";
import type { Document } from "../api/documents";
import type { Project } from "../api/projects";

interface UnifiedAutoGenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (config: AutoGenConfig) => void;
  documents: Document[];
  projects: Project[];
  isGenerating: boolean;
}

export interface AutoGenConfig {
  documentFilename: string;
  generateProjects: boolean;
  generateTasks: boolean;
  selectedProjectIds: number[];
}

const UnifiedAutoGenModal: React.FC<UnifiedAutoGenModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
  documents,
  projects,
  isGenerating,
}) => {
  const [selectedDocument, setSelectedDocument] = useState<string>("");
  const [generateProjects, setGenerateProjects] = useState(true);
  const [generateTasks, setGenerateTasks] = useState(true);
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocument) return;

    onGenerate({
      documentFilename: selectedDocument,
      generateProjects,
      generateTasks,
      selectedProjectIds,
    });
  };

  const handleProjectToggle = (projectId: number) => {
    setSelectedProjectIds((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId]
    );
  };

  const handleReset = () => {
    setSelectedDocument("");
    setGenerateProjects(true);
    setGenerateTasks(true);
    setSelectedProjectIds([]);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  // Find documents that already have projects created
  const documentProjectMap = new Map<string, boolean>();
  documents.forEach((doc) => {
    // Check if any project has the same name as this document (simple heuristic)
    const hasProject = projects.some((proj) =>
      doc.filename.toLowerCase().includes(proj.name.toLowerCase()) ||
      proj.name.toLowerCase().includes(doc.filename.toLowerCase().replace('.pdf', ''))
    );
    documentProjectMap.set(doc.filename, hasProject);
  });

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-content unified-autogen-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>
            <span className="heading-icon">
              <Icon name="ai" size={18} />
            </span>
            Auto-Generate from Document
          </h3>
          {!isGenerating && (
            <button
              onClick={handleClose}
              className="modal-close"
              aria-label="Close"
            >
              <Icon name="close" size={18} />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="document-select">Select Document *</label>
              <select
                id="document-select"
                value={selectedDocument}
                onChange={(e) => setSelectedDocument(e.target.value)}
                required
                disabled={isGenerating}
              >
                <option value="">Choose a document...</option>
                {documents.map((doc) => {
                  const hasProject = documentProjectMap.get(doc.filename);
                  return (
                    <option
                      key={doc.filename}
                      value={doc.filename}
                      disabled={hasProject && !generateTasks}
                    >
                      {doc.filename}
                      {hasProject ? " (Project exists)" : ""}
                    </option>
                  );
                })}
              </select>
              {selectedDocument && documentProjectMap.get(selectedDocument) && (
                <p className="form-hint warning">
                  <Icon name="alert" size={14} /> A project may already exist
                  for this document. Project generation will be disabled.
                </p>
              )}
            </div>

            <div className="form-group">
              <label>What to Generate:</label>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={generateProjects}
                    onChange={(e) => setGenerateProjects(e.target.checked)}
                    disabled={
                      isGenerating ||
                      (!!selectedDocument &&
                        documentProjectMap.get(selectedDocument) === true)
                    }
                  />
                  <span>Generate Project</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={generateTasks}
                    onChange={(e) => setGenerateTasks(e.target.checked)}
                    disabled={isGenerating}
                  />
                  <span>Generate Tasks</span>
                </label>
              </div>
              {!generateProjects && !generateTasks && (
                <p className="form-hint error">
                  Please select at least one option
                </p>
              )}
            </div>

            {generateTasks && (
              <div className="form-group">
                <label>Assign Tasks to Projects (Optional):</label>
                <p className="form-hint">
                  Select which project(s) should receive the generated tasks.
                  Leave empty to generate tasks without project assignment.
                </p>
                <div className="project-multiselect">
                  {projects.length === 0 ? (
                    <p className="empty-state-small">
                      No projects available. Create or generate a project first.
                    </p>
                  ) : (
                    projects.map((project) => (
                      <label
                        key={project.id}
                        className="checkbox-label project-option"
                      >
                        <input
                          type="checkbox"
                          checked={selectedProjectIds.includes(project.id!)}
                          onChange={() => handleProjectToggle(project.id!)}
                          disabled={isGenerating}
                        />
                        <span>
                          {project.name}
                          <small className="project-status">
                            {" "}
                            ({project.status})
                          </small>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClose}
              disabled={isGenerating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={
                isGenerating ||
                !selectedDocument ||
                (!generateProjects && !generateTasks)
              }
            >
              {isGenerating ? (
                <>
                  <Icon name="clock" size={16} /> Generating...
                </>
              ) : (
                <>
                  <Icon name="ai" size={16} /> Generate
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UnifiedAutoGenModal;
