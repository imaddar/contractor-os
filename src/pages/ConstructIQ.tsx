import React, { useState, useEffect } from "react";
import {
  documentsApi,
  type Document,
  type GeneratedProjectDetails,
  type GeneratedTaskDetails,
} from "../api/documents";
import { projectsApi, type Project } from "../api/projects";
import DeleteModal from "../components/DeleteModal";
import UnifiedAutoGenModal, {
  type AutoGenConfig,
} from "../components/UnifiedAutoGenModal";
import AutoGenerationModal from "../components/AutoGenerationModal";
import { Icon } from "../components/Icon";

// Helper function to generate UUID v4
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Helper function to get or create a persistent thread ID
function getOrCreateThreadId(): string {
  const stored = localStorage.getItem("constructiq_thread_id");
  if (stored) {
    return stored;
  }
  const newId = generateUUID();
  localStorage.setItem("constructiq_thread_id", newId);
  return newId;
}

function ConstructIQ() {
  const [uploadedFiles, setUploadedFiles] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingDocument, setDeletingDocument] = useState<Document | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Auto-generation state
  const [showAutoGenModal, setShowAutoGenModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string>("");
  const [thinkingText, setThinkingText] = useState<string>("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [lastGeneratedProject, setLastGeneratedProject] =
    useState<GeneratedProjectDetails | null>(null);
  const [lastGeneratedTasks, setLastGeneratedTasks] = useState<
    GeneratedTaskDetails[]
  >([]);
  const [generationMessage, setGenerationMessage] = useState<string | null>(
    null,
  );
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Chat-related state
  const [chatMessages, setChatMessages] = useState<
    Array<{
      type: "user" | "ai";
      content: string;
      timestamp: string;
    }>
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [threadId, setThreadId] = useState(() => getOrCreateThreadId());
  const [conversations, setConversations] = useState<
    Array<{
      id: string;
      title: string;
      created_at: string;
      updated_at: string;
    }>
  >([]);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);

  useEffect(() => {
    fetchDocuments();
    fetchProjects();
    fetchChatHistory();
    fetchConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      const documents = await documentsApi.getAll();
      setUploadedFiles(documents);
    } catch (err) {
      setError("Failed to load documents");
      console.error("Error fetching documents:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const projectData = await projectsApi.getAll();
      setProjects(projectData);
    } catch (err) {
      console.error("Error fetching projects:", err);
    }
  };

  const fetchChatHistory = async (conversationId?: string) => {
    try {
      setIsLoadingHistory(true);
      const idToFetch = conversationId || threadId;
      const response = await fetch(
        `http://localhost:8000/chat/conversations/${idToFetch}/messages`,
      );

      if (response.ok) {
        const messages = await response.json();

        if (messages && messages.length > 0) {
          // Convert backend messages to frontend format
          const formattedMessages = messages.map(
            (msg: {
              message_type: string;
              content: string;
              created_at?: string;
            }) => ({
              type: msg.message_type as "user" | "ai",
              content: msg.content,
              timestamp: msg.created_at || new Date().toISOString(),
            }),
          );
          setChatMessages(formattedMessages);
          console.log(
            `Loaded ${formattedMessages.length} messages from history`,
          );
        } else {
          // No history, show welcome message
          setChatMessages([
            {
              type: "ai",
              content:
                "Hello! I'm ConstructIQ, your AI assistant for construction project management. I can help you analyze documents, plan projects, create schedules, and answer construction-related questions. What would you like to know?",
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      } else if (response.status === 404 || response.status === 500) {
        // No conversation found or error, start fresh
        setChatMessages([
          {
            type: "ai",
            content:
              "Hello! I'm ConstructIQ, your AI assistant for construction project management. I can help you analyze documents, plan projects, create schedules, and answer construction-related questions. What would you like to know?",
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      console.error("Error loading chat history:", err);
      // On error, show welcome message
      setChatMessages([
        {
          type: "ai",
          content:
            "Hello! I'm ConstructIQ, your AI assistant for construction project management. I can help you analyze documents, plan projects, create schedules, and answer construction-related questions. What would you like to know?",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const fetchConversations = async () => {
    try {
      setIsLoadingConversations(true);
      const response = await fetch("http://localhost:8000/chat/conversations");

      if (response.ok) {
        const data = await response.json();
        setConversations(data);
        console.log(`Loaded ${data.length} conversations`);
      }
    } catch (err) {
      console.error("Error loading conversations:", err);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const loadConversation = async (conversationId: string) => {
    setThreadId(conversationId);
    localStorage.setItem("constructiq_thread_id", conversationId);
    await fetchChatHistory(conversationId);
    setShowHistorySidebar(false);
  };

  const createNewConversation = async () => {
    const newThreadId = generateUUID();
    setThreadId(newThreadId);
    localStorage.setItem("constructiq_thread_id", newThreadId);
    setChatMessages([
      {
        type: "ai",
        content:
          "Hello! I'm ConstructIQ, your AI assistant for construction project management. How can I help you today?",
        timestamp: new Date().toISOString(),
      },
    ]);
    setShowHistorySidebar(false);
    await fetchConversations(); // Refresh the list
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const newDoc = await documentsApi.uploadAndParse(file);
      setUploadedFiles((prev) => [newDoc, ...prev]);
    } catch (err) {
      setError("Failed to parse document. Please try again.");
      console.error("Upload error:", err);
    } finally {
      setIsUploading(false);
      // Reset file input
      event.target.value = "";
    }
  };

  const handleDeleteDocument = (doc: Document) => {
    setDeletingDocument(doc);
    setShowDeleteModal(true);
    setError(null); // Clear any previous errors
  };

  const confirmDelete = async () => {
    if (!deletingDocument?.filename) return;

    try {
      setIsDeleting(true);
      console.log("Deleting document:", deletingDocument.filename);

      // Use the new API method
      await documentsApi.deleteByFilename(deletingDocument.filename);

      console.log("Document deleted successfully");
      setUploadedFiles((prev) =>
        prev.filter((d) => d.filename !== deletingDocument.filename),
      );
      if (selectedDocument?.filename === deletingDocument.filename) {
        setSelectedDocument(null);
      }
      setShowDeleteModal(false);
      setDeletingDocument(null);
      setError(null);
    } catch (err) {
      console.error("Delete error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to delete document",
      );
      // Keep modal open to show error
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDeletingDocument(null);
    setError(null);
  };

  const openDocument = async (doc: Document) => {
    // Check if filename is valid
    if (
      !doc.filename ||
      doc.filename === "Unknown" ||
      doc.filename.trim() === ""
    ) {
      setError("Cannot open document with invalid filename");
      return;
    }

    try {
      // Fetch the full document content using the new API method
      const fullDocument = await documentsApi.getByFilename(doc.filename);
      setSelectedDocument(fullDocument);
    } catch (error) {
      console.error("Error fetching full document:", error);
      setError("Failed to load document content");
      // Fallback to the summary document
      setSelectedDocument(doc);
    }
  };

  const closeDocument = () => {
    setSelectedDocument(null);
  };

  const handleUnifiedGeneration = async (config: AutoGenConfig) => {
    setShowAutoGenModal(false);
    setShowProgressModal(true);
    setIsGenerating(true);
    setGenerationError(null);
    setGenerationMessage(null);
    setLastGeneratedProject(null);
    setLastGeneratedTasks([]);

    try {
      let generatedProject: Project | null = null;
      let generatedTasksList: GeneratedTaskDetails[] = [];

      // Generate project if requested
      if (config.generateProjects) {
        setGenerationProgress("Analyzing document and generating project...");
        setThinkingText("Reading construction document and extracting project details...");
        
        const projectGeneration = await documentsApi.generateProjectFromDocument(
          config.documentFilename,
          true,
        );

        setLastGeneratedProject(projectGeneration.project);
        generatedProject = projectGeneration.created_project || null;

        if (!projectGeneration.persisted && projectGeneration.project) {
          setThinkingText("Creating project in database...");
          const fallbackProjectPayload = {
            name: projectGeneration.project.name,
            description: projectGeneration.project.description,
            address: projectGeneration.project.address || undefined,
            status: "planning",
            start_date: projectGeneration.project.start_date || undefined,
            end_date: projectGeneration.project.end_date || undefined,
            budget: projectGeneration.project.budget_estimate ?? undefined,
          };
          generatedProject = await projectsApi.create(fallbackProjectPayload);
        }

        await fetchProjects();
      }

      // Generate tasks if requested
      if (config.generateTasks) {
        setGenerationProgress("Generating tasks from document...");
        setThinkingText("Analyzing project scope and identifying key tasks...");

        // Generate tasks for each selected project, or without project if none selected
        if (config.selectedProjectIds.length > 0) {
          for (const projectId of config.selectedProjectIds) {
            const taskGeneration = await documentsApi.generateTasksFromDocument(
              config.documentFilename,
              true,
              projectId,
            );
            generatedTasksList = [...generatedTasksList, ...taskGeneration.tasks];
          }
        } else if (generatedProject) {
          // If we just generated a project, assign tasks to it
          const taskGeneration = await documentsApi.generateTasksFromDocument(
            config.documentFilename,
            true,
            generatedProject.id,
          );
          generatedTasksList = taskGeneration.tasks;
        } else {
          // Generate tasks without project assignment
          const taskGeneration = await documentsApi.generateTasksFromDocument(
            config.documentFilename,
            false,
          );
          generatedTasksList = taskGeneration.tasks;
        }

        setLastGeneratedTasks(generatedTasksList);
      }

      // Build success message
      const messages: string[] = [];
      if (generatedProject) {
        messages.push(`Created project "${generatedProject.name}"`);
      }
      if (generatedTasksList.length > 0) {
        messages.push(`Generated ${generatedTasksList.length} tasks`);
      }
      setGenerationMessage(messages.join(" and ") + ` from ${config.documentFilename}`);

    } catch (err) {
      console.error("Generation error:", err);
      const message =
        err instanceof Error ? err.message : "Failed to generate from document";
      setGenerationError(message);
    } finally {
      setIsGenerating(false);
      setGenerationProgress("");
      setThinkingText("");
      // Auto-close progress modal after a short delay
      setTimeout(() => {
        setShowProgressModal(false);
      }, 2000);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unknown size";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Unknown date";
    return new Date(dateString).toLocaleString();
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = {
      type: "user" as const,
      content: chatInput.trim(),
      timestamp: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setIsChatLoading(true);
    setError(null);

    try {
      const response = await fetch("http://localhost:8000/chat/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage.content,
          thread_id: threadId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const data = await response.json();

      // Add AI responses to chat
      if (data.ai_responses && data.ai_responses.length > 0) {
        const aiMessages = data.ai_responses.map(
          (resp: { content: string; timestamp: string }) => ({
            type: "ai" as const,
            content: resp.content,
            timestamp: resp.timestamp,
          }),
        );
        setChatMessages((prev) => [...prev, ...aiMessages]);
      }

      // Refresh conversation list to update timestamps
      fetchConversations();
    } catch (err) {
      console.error("Chat error:", err);
      setError("Failed to send message. Please try again.");
      setChatMessages((prev) => [
        ...prev,
        {
          type: "ai",
          content:
            "Sorry, I encountered an error processing your message. Please try again.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const startNewChat = () => {
    // Just create a new conversation without deleting the current one
    createNewConversation();
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      await fetch(
        `http://localhost:8000/chat/conversations/${conversationId}`,
        {
          method: "DELETE",
        },
      );

      // If we deleted the current conversation, create a new one
      if (conversationId === threadId) {
        createNewConversation();
      } else {
        // Just refresh the conversation list
        fetchConversations();
      }
    } catch (err) {
      console.error("Error deleting conversation:", err);
      setError("Failed to delete conversation");
    }
  };

  if (isLoading) {
    return (
      <div className="page-content">
        <div className="page-header">
          <h1>ConstructIQ</h1>
          <p className="dashboard-subtitle">
            AI-powered document processing and insights
          </p>
        </div>
        <div style={{ textAlign: "center", padding: "2rem" }}>
          Loading documents...
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>ConstructIQ</h1>
        <p className="dashboard-subtitle">
          AI-powered document processing and construction intelligence
        </p>
      </div>

      <div className="constructiq-container">
        <div className="upload-section">
          <div className="upload-card">
            <h2>
              <span className="heading-icon">
                <Icon name="document" size={20} />
              </span>
              Document Parser
            </h2>
            <p>
              Upload PDF documents to extract and analyze their content using
              AI. Documents are automatically chunked and stored for intelligent
              analysis.
            </p>

            <div className="upload-area">
              <input
                type="file"
                id="file-upload"
                accept=".pdf"
                onChange={handleFileUpload}
                disabled={isUploading}
                style={{ display: "none" }}
              />
              <label
                htmlFor="file-upload"
                className={`upload-button ${isUploading ? "uploading" : ""}`}
              >
                {isUploading ? (
                  <>
                    <span className="upload-icon">
                      <Icon name="clock" size={18} />
                    </span>
                    Processing & Chunking...
                  </>
                ) : (
                  <>
                    <span className="upload-icon">
                      <Icon name="upload" size={18} />
                    </span>
                    Upload PDF Document
                  </>
                )}
              </label>
            </div>

            {error && !showDeleteModal && (
              <div className="error-message" style={{ marginTop: "1rem" }}>
                {error}
              </div>
            )}
          </div>
        </div>

        {/* AI Chat Section */}
        <div className="chat-section">
          <div className="upload-card">
            <div className="chat-header">
              <h2>
                <span className="heading-icon">
                  <Icon name="ai" size={20} />
                </span>
                ConstructIQ AI Assistant
              </h2>
              <div
                style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}
              >
                <button
                  onClick={() => setShowHistorySidebar(!showHistorySidebar)}
                  className="btn btn-small btn-secondary"
                >
                  <Icon name="clock" size={16} />
                  {showHistorySidebar ? "Hide" : "History"}
                </button>
                <button
                  onClick={startNewChat}
                  className="btn btn-small btn-secondary"
                >
                  New Chat
                </button>
              </div>
            </div>
            <p>
              Ask questions about your documents, get construction advice, or
              discuss project management topics. Your chat history is
              automatically saved.
            </p>

            <div className="chat-container" style={{ position: "relative" }}>
              {/* Chat History Sidebar */}
              {showHistorySidebar && (
                <div className="chat-history-sidebar">
                  <div className="chat-history-header">
                    <h3>Chat History</h3>
                  </div>
                  <div className="chat-history-list">
                    {isLoadingConversations ? (
                      <div className="chat-history-empty">Loading...</div>
                    ) : conversations.length === 0 ? (
                      <div className="chat-history-empty">
                        No conversations yet
                      </div>
                    ) : (
                      conversations.map((conv) => (
                        <div
                          key={conv.id}
                          className={`chat-history-item ${
                            conv.id === threadId ? "active" : ""
                          }`}
                          onClick={() => loadConversation(conv.id)}
                        >
                          <div className="chat-history-item-title">
                            {conv.title}
                          </div>
                          <div className="chat-history-item-date">
                            {new Date(
                              conv.updated_at || conv.created_at,
                            ).toLocaleDateString()}
                          </div>
                          {conv.id !== threadId && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteConversation(conv.id);
                              }}
                              className="chat-history-delete-btn"
                              title="Delete conversation"
                            >
                              <Icon name="close" size={14} />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div
                className="chat-messages"
                style={{ marginLeft: showHistorySidebar ? "300px" : "0" }}
              >
                {isLoadingHistory ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "2rem",
                      color: "var(--text-soft)",
                    }}
                  >
                    <Icon name="clock" size={20} />
                    <p>Loading chat history...</p>
                  </div>
                ) : (
                  <>
                    {chatMessages.map((message, index) => (
                      <div
                        key={index}
                        className={`chat-message ${message.type}`}
                      >
                        <div className="message-avatar">
                          <Icon
                            name={message.type === "user" ? "team" : "ai"}
                            size={16}
                          />
                        </div>
                        <div className="message-content">
                          <div className="message-text">{message.content}</div>
                          <div className="message-time">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))}
                    {isChatLoading && (
                      <div className="chat-message ai">
                        <div className="message-avatar">
                          <Icon name="ai" size={16} />
                        </div>
                        <div className="message-content">
                          <div className="message-text typing">
                            ConstructIQ is thinking...
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="chat-input-area">
                <div className="chat-input-group">
                  <input
                    type="text"
                    placeholder="Ask ConstructIQ about your projects, documents, or construction topics..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) =>
                      e.key === "Enter" && !e.shiftKey && handleSendMessage()
                    }
                    className="chat-input"
                    disabled={isChatLoading || isLoadingHistory}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={
                      isChatLoading || !chatInput.trim() || isLoadingHistory
                    }
                    className="btn btn-primary chat-send-btn"
                  >
                    {isChatLoading ? "..." : "Send"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="documents-section">
          <div className="section-header">
            <h3>Processed Documents</h3>
            {uploadedFiles.length > 0 && (
              <button
                className="btn btn-primary"
                onClick={() => setShowAutoGenModal(true)}
                disabled={isGenerating}
              >
                <Icon name="ai" size={16} />
                Auto-Generate
              </button>
            )}
          </div>
          {generationMessage && (
            <div className="success-message" style={{ marginBottom: "1rem" }}>
              {generationMessage}
            </div>
          )}
          {generationError && (
            <div className="error-message" style={{ marginBottom: "1rem" }}>
              {generationError}
            </div>
          )}
          {lastGeneratedProject && (
            <div className="generated-project-card">
              <div className="generated-project-title">
                <h4>{lastGeneratedProject.name}</h4>
                {lastGeneratedProject.confidence && (
                  <span className="confidence-tag">
                    {lastGeneratedProject.confidence}
                  </span>
                )}
              </div>
              <p className="generated-project-description">
                {lastGeneratedProject.description}
              </p>
              <div className="generated-project-details">
                <div>
                  <strong>Address:</strong>{" "}
                  {lastGeneratedProject.address || "Not specified"}
                </div>
                <div>
                  <strong>Start Date:</strong>{" "}
                  {lastGeneratedProject.start_date || "TBD"}
                </div>
                <div>
                  <strong>End Date:</strong>{" "}
                  {lastGeneratedProject.end_date || "TBD"}
                </div>
                <div>
                  <strong>Budget:</strong>{" "}
                  {typeof lastGeneratedProject.budget_estimate === "number"
                    ? `${lastGeneratedProject.budget_currency || "USD"} ${lastGeneratedProject.budget_estimate.toLocaleString()}`
                    : "Estimate pending"}
                </div>
              </div>
              {lastGeneratedProject.assumptions && (
                <div className="generated-project-assumptions">
                  <strong>Assumptions:</strong>
                  <ul>
                    {lastGeneratedProject.assumptions.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {lastGeneratedProject.additional_notes && (
                <p className="generated-project-notes">
                  <strong>Notes:</strong>{" "}
                  {lastGeneratedProject.additional_notes}
                </p>
              )}
            </div>
          )}
          {lastGeneratedTasks.length > 0 && (
            <div className="generated-tasks-card">
              <h4>Generated Tasks ({lastGeneratedTasks.length})</h4>
              <ul className="tasks-list">
                {lastGeneratedTasks.map((task, idx) => (
                  <li key={idx} className="task-item">
                    <strong>{task.task_name}</strong>
                    {task.description && <p>{task.description}</p>}
                    {(task.start_date || task.end_date) && (
                      <p className="task-dates">
                        {task.start_date && `Start: ${task.start_date}`}
                        {task.start_date && task.end_date && " | "}
                        {task.end_date && `End: ${task.end_date}`}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {uploadedFiles.length === 0 ? (
            <div className="empty-state">
              <p>
                No documents uploaded yet. Upload your first PDF to get started!
              </p>
            </div>
          ) : (
            <div className="documents-grid">
              {uploadedFiles.map((doc, index) => (
                <div key={`${doc.filename}-${index}`} className="document-card">
                  <div className="document-header">
                    <h4>
                      <span className="heading-icon">
                        <Icon name="document" size={16} />
                      </span>
                      {doc.filename}
                    </h4>
                    <span className="upload-time">
                      {formatDate(doc.uploaded_at)}
                    </span>
                  </div>
                  <div className="document-metadata">
                    <p>
                      <strong>Size:</strong> {formatFileSize(doc.file_size)}
                    </p>
                    <p>
                      <strong>Pages:</strong> {doc.page_count || "Unknown"}
                    </p>
                    <p>
                      <strong>Chunks:</strong> {doc.chunk_count || "Unknown"}
                    </p>
                    <p>
                      <strong>Status:</strong> Stored as searchable chunks
                    </p>
                  </div>
                  <div className="document-preview">
                    <p>{doc.content}</p>
                  </div>
                  <div className="document-actions">
                    <button
                      className="btn btn-small btn-primary"
                      onClick={() => openDocument(doc)}
                      disabled={!doc.filename || doc.filename === "Unknown"}
                    >
                      View Full Text
                    </button>
                    <button
                      className="btn btn-small btn-danger"
                      onClick={() => handleDeleteDocument(doc)}
                      disabled={!doc.filename || doc.filename === "Unknown"}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="features-section">
          <h3>AI-Powered Features</h3>
          <div className="features-grid">
            <div className="feature-card">
              <h4>
                <span className="heading-icon">
                  <Icon name="ai" size={16} />
                </span>
                Intelligent Chat
              </h4>
              <p>
                Conversational AI that understands construction context and can
                analyze your uploaded documents. Chat history is automatically
                saved.
              </p>
            </div>
            <div className="feature-card">
              <h4>
                <span className="heading-icon">
                  <Icon name="projects" size={16} />
                </span>
                Document Analysis
              </h4>
              <p>
                AI automatically processes and understands construction
                documents for intelligent question answering.
              </p>
            </div>
            <div className="feature-card">
              <h4>
                <span className="heading-icon">
                  <Icon name="handshake" size={16} />
                </span>
                Construction Expertise
              </h4>
              <p>
                Specialized knowledge in project management, scheduling,
                budgeting, and construction best practices.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Document Viewer Modal */}
      {selectedDocument && (
        <div className="modal-overlay" onClick={closeDocument}>
          <div
            className="modal-content document-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>
                <span className="heading-icon">
                  <Icon name="document" size={18} />
                </span>
                {selectedDocument.filename}
              </h3>
              <button
                onClick={closeDocument}
                className="modal-close"
                aria-label="Close document"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="document-metadata">
                <p>
                  <strong>Uploaded:</strong>{" "}
                  {formatDate(selectedDocument.uploaded_at)}
                </p>
                <p>
                  <strong>Size:</strong>{" "}
                  {formatFileSize(selectedDocument.file_size)}
                </p>
                <p>
                  <strong>Pages:</strong>{" "}
                  {selectedDocument.page_count || "Unknown"}
                </p>
                <p>
                  <strong>Chunks:</strong>{" "}
                  {selectedDocument.chunk_count || "Unknown"}
                </p>
                <p>
                  <strong>Storage:</strong> Vector database with semantic search
                </p>
              </div>
              <div className="document-content">
                {selectedDocument.content.includes(
                  "Document processed into",
                ) ? (
                  <div>
                    <p>
                      <em>
                        This document has been processed and stored as
                        searchable chunks in the vector database. Use the search
                        feature above to query the document content.
                      </em>
                    </p>
                    <div className="document-summary">
                      <h4>Processing Summary:</h4>
                      <p>{selectedDocument.content}</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p>
                      <em>
                        Full document text extracted from PDF. This content is
                        also stored as searchable chunks for AI analysis.
                      </em>
                    </p>
                    <textarea
                      value={selectedDocument.content}
                      readOnly
                      className="document-text"
                      rows={20}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="modal-actions">
              {!selectedDocument.content.includes(
                "Document processed into",
              ) && (
                <button
                  className="btn btn-secondary"
                  onClick={() =>
                    navigator.clipboard.writeText(selectedDocument.content)
                  }
                >
                  Copy Full Text
                </button>
              )}
              <button className="btn btn-primary" onClick={closeDocument}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <DeleteModal
        isOpen={showDeleteModal}
        title="Delete Document"
        message="Are you sure you want to delete this document? This will remove all associated chunks from the vector database. This action cannot be undone."
        itemName={deletingDocument?.filename || ""}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        isLoading={isDeleting}
        error={error}
      />

      <UnifiedAutoGenModal
        isOpen={showAutoGenModal}
        onClose={() => setShowAutoGenModal(false)}
        onGenerate={handleUnifiedGeneration}
        documents={uploadedFiles}
        projects={projects}
        isGenerating={isGenerating}
      />

      <AutoGenerationModal
        isOpen={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        isGenerating={isGenerating}
        thinkingText={thinkingText}
        progress={generationProgress}
      />
    </div>
  );
}

export default ConstructIQ;
