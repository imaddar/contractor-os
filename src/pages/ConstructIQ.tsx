import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  documentsApi,
  type Document,
  type GeneratedProjectDetails,
} from "../api/documents";
import { projectsApi, type Project } from "../api/projects";
import type { Schedule } from "../api/schedules";
import DeleteModal from "../components/DeleteModal";
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

type ProgressStatus = "pending" | "in-progress" | "completed" | "error";

interface ProgressStepState {
  id: string;
  label: string;
  status: ProgressStatus;
}

interface ThinkingLine {
  id: string;
  text: string;
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [generationModalOpen, setGenerationModalOpen] = useState(false);
  const [selectedGenerationDocument, setSelectedGenerationDocument] =
    useState("");
  const [selectedGenerationProjects, setSelectedGenerationProjects] = useState<
    string[]
  >([]);
  const [shouldGenerateProject, setShouldGenerateProject] = useState(true);
  const [shouldGenerateTasks, setShouldGenerateTasks] = useState(true);
  const [generationMaxTasks, setGenerationMaxTasks] = useState(8);
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [progressSteps, setProgressSteps] = useState<ProgressStepState[]>([]);
  const [generationComplete, setGenerationComplete] = useState(false);
  const [thinkingFeed, setThinkingFeed] = useState<ThinkingLine[]>([]);
  const thinkingTimeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const thinkingSequencesRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationSuccess, setGenerationSuccess] = useState<string | null>(
    null,
  );
  const [latestGeneratedProject, setLatestGeneratedProject] =
    useState<GeneratedProjectDetails | null>(null);
  const [latestGeneratedProjectRecord, setLatestGeneratedProjectRecord] =
    useState<Project | null>(null);
  const [latestGeneratedTasks, setLatestGeneratedTasks] = useState<
    Array<{
      projectId: number;
      projectName: string;
      tasks: Schedule[];
      document: string;
    }>
  >([]);
  const [generatedProjectDocs, setGeneratedProjectDocs] = useState<string[]>(
    [],
  );
  const [lastGenerationDocument, setLastGenerationDocument] = useState<
    string | null
  >(null);
  const [showFeatureInfo, setShowFeatureInfo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    fetchChatHistory();
    fetchConversations();
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const storedDocs = localStorage.getItem("constructiq_generated_projects");
      if (storedDocs) {
        const parsed = JSON.parse(storedDocs);
        if (Array.isArray(parsed)) {
          const sanitized = parsed.filter(
            (item): item is string => typeof item === "string" && item.length > 0,
          );
          if (sanitized.length > 0) {
            setGeneratedProjectDocs(sanitized);
          }
        }
      }
    } catch (storageError) {
      console.warn("Failed to restore generated project docs:", storageError);
    }
  }, []);

  useEffect(() => {
    if (!selectedGenerationDocument && uploadedFiles.length > 0) {
      const firstValid = uploadedFiles.find(
        (doc) => doc.filename && doc.filename !== "Unknown",
      );
      if (firstValid?.filename) {
        setSelectedGenerationDocument(firstValid.filename);
      }
    }
  }, [uploadedFiles, selectedGenerationDocument]);

  useEffect(() => {
    if (projects.length === 0) {
      return;
    }
    setSelectedGenerationProjects((previous) => {
      const validIds = previous.filter((id) =>
        projects.some((project) => project.id?.toString() === id),
      );
      if (validIds.length > 0) {
        return validIds;
      }
      const firstProject = projects.find((project) => project.id);
      return firstProject?.id ? [firstProject.id.toString()] : [];
    });
  }, [projects]);

  useEffect(() => {
    localStorage.setItem(
      "constructiq_generated_projects",
      JSON.stringify(generatedProjectDocs),
    );
  }, [generatedProjectDocs]);

  useEffect(() => {
    if (
      selectedGenerationDocument &&
      generatedProjectDocs.includes(selectedGenerationDocument)
    ) {
      setShouldGenerateProject(false);
    }
  }, [selectedGenerationDocument, generatedProjectDocs]);

  useEffect(() => {
    return () => {
      thinkingTimeoutsRef.current.forEach((timerId) =>
        window.clearTimeout(timerId),
      );
      thinkingSequencesRef.current.forEach((timerId) =>
        window.clearTimeout(timerId),
      );
      thinkingTimeoutsRef.current = [];
      thinkingSequencesRef.current = [];
    };
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

  const fetchProjects = async () => {
    try {
      const projectList = await projectsApi.getAll();
      setProjects(projectList);
    } catch (err) {
      console.error("Error fetching projects:", err);
    }
  };

  const clearThinkingTimers = useCallback(() => {
    thinkingSequencesRef.current.forEach((timerId) =>
      window.clearTimeout(timerId),
    );
    thinkingSequencesRef.current = [];
    thinkingTimeoutsRef.current.forEach((timerId) => window.clearTimeout(timerId));
    thinkingTimeoutsRef.current = [];
  }, []);

  const enqueueThinking = useCallback(
    (text: string) => {
      if (!text) return;
      const id = generateUUID();
      setThinkingFeed((previous) => [...previous, { id, text }]);
      const timeoutId = window.setTimeout(() => {
        setThinkingFeed((prev) => prev.filter((line) => line.id !== id));
        thinkingTimeoutsRef.current = thinkingTimeoutsRef.current.filter(
          (storedId) => storedId !== timeoutId,
        );
      }, 4000);
      thinkingTimeoutsRef.current.push(timeoutId);
    },
    [setThinkingFeed],
  );

  const enqueueThinkingSequence = useCallback(
    (messages: string[], spacingMs = 1400) => {
      clearThinkingTimers();
      messages.forEach((message, index) => {
        const timerId = window.setTimeout(() => {
          enqueueThinking(message);
        }, index * spacingMs);
        thinkingSequencesRef.current.push(timerId);
      });
    },
    [clearThinkingTimers, enqueueThinking],
  );

  const extractThinkingSnippets = (text: string) => {
    if (!text) return [];
    const normalized = text.replace(/\s+/g, " ").trim();
    if (!normalized) return [];
    const sentenceSplit = normalized
      .split(/(?<=[.?!])\s+/)
      .map((segment) => segment.trim())
      .filter((segment) => segment && segment.length > 3);
    if (sentenceSplit.length > 0) {
      return sentenceSplit.slice(0, 4);
    }
    const fallback = normalized
      .split(",")
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 3);
    return fallback.slice(0, 4);
  };

  const updateProgressStep = useCallback(
    (stepId: string, status: ProgressStatus) => {
      setProgressSteps((previous) =>
        previous.map((step) =>
          step.id === stepId ? { ...step, status } : step,
        ),
      );
    },
    [],
  );

  const addGeneratedProjectDoc = useCallback((filename: string) => {
    if (!filename) return;
    setGeneratedProjectDocs((previous) => {
      if (previous.includes(filename)) {
        return previous;
      }
      return [...previous, filename];
    });
  }, []);

  const resetGenerationResults = useCallback(() => {
    setLatestGeneratedProject(null);
    setLatestGeneratedProjectRecord(null);
    setLatestGeneratedTasks([]);
    setGenerationError(null);
    setGenerationSuccess(null);
    setLastGenerationDocument(null);
  }, []);

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
      setGeneratedProjectDocs((prev) =>
        prev.filter((name) => name !== deletingDocument.filename),
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

  const openGenerationModal = (mode: "project" | "tasks" | "both" = "both") => {
    if (!hasValidDocuments || !hasSelectableProjects) {
      return;
    }
    setGenerationError(null);
    setGenerationSuccess(null);
    let defaultDocument = selectedGenerationDocument
      ? selectedGenerationDocument
      : uploadedFiles.find((doc) => doc.filename && doc.filename !== "Unknown")
          ?.filename || "";
    if (
      mode === "project" &&
      defaultDocument &&
      generatedProjectDocs.includes(defaultDocument)
    ) {
      const nextDoc = uploadedFiles.find(
        (doc) =>
          doc.filename &&
          doc.filename !== "Unknown" &&
          !generatedProjectDocs.includes(doc.filename),
      );
      if (nextDoc?.filename) {
        defaultDocument = nextDoc.filename;
      }
    }
    setSelectedGenerationDocument(defaultDocument);

    const validProjectIds = projects
      .filter((project) => project.id)
      .map((project) => project.id!.toString());
    setSelectedGenerationProjects((previous) => {
      if (previous.length > 0) {
        const filtered = previous.filter((value) => validProjectIds.includes(value));
        if (filtered.length > 0) {
          return filtered;
        }
      }
      return validProjectIds.slice(0, 1);
    });

    const docAlreadyGenerated =
      defaultDocument !== "" &&
      generatedProjectDocs.includes(defaultDocument);
    if (mode === "project") {
      setShouldGenerateProject(!docAlreadyGenerated);
      setShouldGenerateTasks(false);
    } else if (mode === "tasks") {
      setShouldGenerateProject(false);
      setShouldGenerateTasks(true);
    } else {
      setShouldGenerateProject(!docAlreadyGenerated);
      setShouldGenerateTasks(true);
    }
    setGenerationMaxTasks(8);
    setGenerationModalOpen(true);
  };

  const closeGenerationModal = () => {
    if (progressModalOpen && !generationComplete) {
      return;
    }
    setGenerationModalOpen(false);
    setGenerationError(null);
  };

  const closeProgressModal = () => {
    if (!generationComplete) return;
    setProgressModalOpen(false);
    clearThinkingTimers();
    setThinkingFeed([]);
    thinkingTimeoutsRef.current.forEach((timerId) => window.clearTimeout(timerId));
    thinkingTimeoutsRef.current = [];
  };

  const handleGenerationSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedGenerationDocument) {
      setGenerationError("Select a document to continue.");
      return;
    }

    if (!shouldGenerateProject && !shouldGenerateTasks) {
      setGenerationError("Choose at least one generation option.");
      return;
    }

    if (shouldGenerateTasks && selectedGenerationProjects.length === 0) {
      setGenerationError("Select at least one project to generate tasks for.");
      return;
    }

    resetGenerationResults();
    setGenerationModalOpen(false);
    setProgressModalOpen(true);
    setGenerationComplete(false);
    setThinkingFeed([]);
    clearThinkingTimers();
    setProgressSteps(() => {
      const baseSteps: ProgressStepState[] = [
        {
          id: "context",
          label: "Preparing document context",
          status: "in-progress",
        },
      ];
      if (shouldGenerateProject) {
        baseSteps.push({
          id: "project",
          label: "Generating project brief",
          status: "pending",
        });
      }
      if (shouldGenerateTasks) {
        selectedGenerationProjects.forEach((projectId) => {
          const projectName =
            projects.find((project) => project.id?.toString() === projectId)?.name ||
            "Selected project";
          baseSteps.push({
            id: `tasks-${projectId}`,
            label: `Generating tasks for ${projectName}`,
            status: "pending",
          });
        });
      }
      return baseSteps;
    });

    try {
      updateProgressStep("context", "completed");

      if (shouldGenerateProject) {
        updateProgressStep("project", "in-progress");
        const projectResponse = await documentsApi.generateProjectFromDocument(
          selectedGenerationDocument,
          true,
        );

        setLatestGeneratedProject(projectResponse.project);
        if (projectResponse.created_project) {
          setLatestGeneratedProjectRecord(projectResponse.created_project);
        } else if (!projectResponse.persisted) {
          const fallbackPayload: Omit<Project, "id"> = {
            name: projectResponse.project.name,
            description: projectResponse.project.description,
            address: projectResponse.project.address || undefined,
            status: "planning",
            start_date: projectResponse.project.start_date || undefined,
            end_date: projectResponse.project.end_date || undefined,
            budget: projectResponse.project.budget_estimate ?? undefined,
          };
          try {
            const created = await projectsApi.create(fallbackPayload);
            setLatestGeneratedProjectRecord(created);
          } catch (creationError) {
            console.error("Fallback project creation failed:", creationError);
          }
        }
        addGeneratedProjectDoc(selectedGenerationDocument);

        const snippetSources = [
          ...(projectResponse.raw_response
            ? extractThinkingSnippets(projectResponse.raw_response)
            : []),
        ];
        if (snippetSources.length > 0) {
          enqueueThinkingSequence(snippetSources);
        } else {
          enqueueThinkingSequence([
            "Drafting project summary...",
            "Reviewing timeline assumptions...",
          ]);
        }

        updateProgressStep("project", "completed");
      }

      if (shouldGenerateTasks) {
        const taskResults: Array<{
          projectId: number;
          projectName: string;
          tasks: Schedule[];
          document: string;
        }> = [];

        for (const projectIdString of selectedGenerationProjects) {
          const projectId = parseInt(projectIdString, 10);
          if (!Number.isFinite(projectId)) continue;
          const projectName =
            projects.find((project) => project.id === projectId)?.name ||
            "Selected project";
          updateProgressStep(`tasks-${projectIdString}`, "in-progress");

          const taskResponse = await documentsApi.generateTasksFromDocument(
            selectedGenerationDocument,
            projectId,
            { maxTasks: generationMaxTasks, persist: true },
          );

          taskResults.push({
            projectId,
            projectName,
            tasks: taskResponse.tasks,
            document: selectedGenerationDocument,
          });

          const snippets = [
            ...(taskResponse.thinking_log || []),
            ...(taskResponse.raw_response
              ? extractThinkingSnippets(taskResponse.raw_response)
              : []),
          ].filter((line, index, array) => line && array.indexOf(line) === index);
          if (snippets.length > 0) {
            enqueueThinkingSequence(snippets);
          } else {
            enqueueThinkingSequence([
              `Reviewing milestones for ${projectName}...`,
              "Summarizing task breakdown...",
            ]);
          }

          updateProgressStep(`tasks-${projectIdString}`, "completed");
        }

        setLatestGeneratedTasks(taskResults);
      }

      setGenerationComplete(true);
      const docLabel = selectedGenerationDocument;
      setLastGenerationDocument(docLabel);
      const projectCount = shouldGenerateProject ? 1 : 0;
      const taskProjectCount = shouldGenerateTasks
        ? selectedGenerationProjects.length
        : 0;

      const summaryParts = [];
      if (projectCount > 0) {
        summaryParts.push("project brief");
      }
      if (taskProjectCount > 0) {
        summaryParts.push(
          `${taskProjectCount} task set${taskProjectCount === 1 ? "" : "s"}`,
        );
      }
      const summary = summaryParts.join(" and ");
      setGenerationSuccess(
        `Generated ${summary} from ${docLabel}. Review schedules to accept proposed items.`,
      );
    } catch (err) {
      console.error("Generation error:", err);
      setGenerationComplete(true);
      const message =
        err instanceof Error ? err.message : "Failed to complete generation.";
      setGenerationError(message);
      setProgressSteps((previous) =>
        previous.map((step) =>
          step.status === "in-progress" ? { ...step, status: "error" } : step,
        ),
      );
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

  const hasValidDocuments = uploadedFiles.some(
    (doc) => doc.filename && doc.filename !== "Unknown",
  );
  const hasSelectableProjects = projects.some((project) => project.id);

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

  const handleUploadButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>ConstructIQ</h1>
          <div className="page-subtitle-row">
            <p className="dashboard-subtitle">
              AI-powered document processing and construction intelligence
            </p>
            <button
              type="button"
              className="info-button"
              onClick={() => setShowFeatureInfo((prev) => !prev)}
              aria-label="Show ConstructIQ capabilities"
            >
              <Icon name="info" size={16} />
            </button>
          </div>
          {showFeatureInfo && (
            <div className="info-popover">
              <p>
                ConstructIQ helps you analyze construction documents, generate project briefs,
                and auto-populate schedule tasks with AI assistance.
              </p>
              <ul>
                <li>
                  <strong>Intelligent chat:</strong> ask questions about your plans and files.
                </li>
                <li>
                  <strong>Document analysis:</strong> upload PDFs and keep them searchable.
                </li>
                <li>
                  <strong>Construction expertise:</strong> get schedule, budget, and scope guidance.
                </li>
              </ul>
            </div>
          )}
        </div>
        <button
          className="btn btn-primary"
          onClick={() => openGenerationModal("both")}
          disabled={
            !hasValidDocuments ||
            !hasSelectableProjects ||
            isUploading ||
            isLoading
          }
          title={
            !hasValidDocuments
              ? "Upload a document to enable the AI generator"
              : !hasSelectableProjects
                ? "Create a project before running the AI generator"
                : "Generate project briefs and tasks from your documents"
          }
        >
          <Icon name="tasks" size={16} />
          <span style={{ marginLeft: "0.5rem" }}>Run Full Generation</span>
        </button>
      </div>

      <div className="constructiq-container">
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

        <input
          type="file"
          ref={fileInputRef}
          accept=".pdf"
          onChange={handleFileUpload}
          disabled={isUploading}
          style={{ display: "none" }}
        />

        <div className="action-button-row">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleUploadButtonClick}
            disabled={isUploading}
          >
            <Icon name="upload" size={16} />
            <span>{isUploading ? "Uploading..." : "Upload PDF"}</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => openGenerationModal("project")}
            disabled={
              !hasValidDocuments ||
              isLoading ||
              isUploading
            }
          >
            <Icon name="projects" size={16} />
            <span>Generate Project</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => openGenerationModal("tasks")}
            disabled={
              !hasValidDocuments ||
              !hasSelectableProjects ||
              isLoading ||
              isUploading
            }
          >
            <Icon name="tasks" size={16} />
            <span>Generate Tasks</span>
          </button>
        </div>

        {error && !showDeleteModal && (
          <div className="error-message" style={{ marginBottom: "1rem" }}>
            {error}
          </div>
        )}

        <div className="documents-section">
          <h3>Processed Documents</h3>
          {generationSuccess && (
            <div className="success-message" style={{ marginBottom: "1rem" }}>
              {generationSuccess}
            </div>
          )}
          {generationError && (
            <div className="error-message" style={{ marginBottom: "1rem" }}>
              {generationError}
            </div>
          )}
          {latestGeneratedProject && (
            <div className="generated-project-card">
              <div className="generated-project-title">
                <h4>{latestGeneratedProject.name}</h4>
                {latestGeneratedProject.confidence && (
                  <span className="confidence-tag">
                    {latestGeneratedProject.confidence}
                  </span>
                )}
              </div>
              {(lastGenerationDocument || selectedGenerationDocument) && (
                <p className="generated-project-source">
                  Generated from: {lastGenerationDocument || selectedGenerationDocument}
                </p>
              )}
              <p className="generated-project-description">
                {latestGeneratedProject.description}
              </p>
              <div className="generated-project-details">
                <div>
                  <strong>Address:</strong>{" "}
                  {latestGeneratedProject.address || "Not specified"}
                </div>
                <div>
                  <strong>Start Date:</strong>{" "}
                  {latestGeneratedProject.start_date || "TBD"}
                </div>
                <div>
                  <strong>End Date:</strong>{" "}
                  {latestGeneratedProject.end_date || "TBD"}
                </div>
                <div>
                  <strong>Budget:</strong>{" "}
                  {typeof latestGeneratedProject.budget_estimate === "number"
                    ? `${latestGeneratedProject.budget_currency || "USD"} ${latestGeneratedProject.budget_estimate.toLocaleString()}`
                    : "Estimate pending"}
                </div>
              </div>
              {latestGeneratedProject.assumptions && (
                <div className="generated-project-assumptions">
                  <strong>Assumptions:</strong>
                  <ul>
                    {latestGeneratedProject.assumptions.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {latestGeneratedProject.additional_notes && (
                <p className="generated-project-notes">
                  <strong>Notes:</strong>{" "}
                  {latestGeneratedProject.additional_notes}
                </p>
              )}
              {latestGeneratedProjectRecord && (
                <p className="generated-project-status">
                  Project status: {latestGeneratedProjectRecord.status}
                </p>
              )}
            </div>
          )}
          {latestGeneratedTasks.length > 0 && (
            <div className="generated-tasks-preview">
              <h4>Generated Proposed Tasks</h4>
              <p className="preview-hint">
                Proposed tasks are saved with status <strong>proposed</strong>.
                Review them from the Schedule page to accept or discard.
              </p>
              <div className="projects-grid">
                {latestGeneratedTasks.map((group) => (
                  <div className="project-card" key={`generated-${group.projectId}`}>
                    <div className="project-header">
                      <h3>{group.projectName}</h3>
                      <span className="status proposed">proposed</span>
                    </div>
                    <div className="project-details">
                      <div className="detail">
                        <strong>Document:</strong> {group.document}
                      </div>
                      <div className="detail">
                        <strong>Tasks:</strong> {group.tasks.length}
                      </div>
                    </div>
                    <ul className="task-preview-list">
                      {group.tasks.slice(0, 4).map((task) => (
                        <li key={`${group.projectId}-${task.task_name}`}>
                          <span>{task.task_name}</span>
                          <span className="date-range">
                            {task.start_date
                              ? new Date(task.start_date).toLocaleDateString()
                              : "TBD"}
                            {" "}-{" "}
                            {task.end_date
                              ? new Date(task.end_date).toLocaleDateString()
                              : "TBD"}
                          </span>
                        </li>
                      ))}
                      {group.tasks.length > 4 && (
                        <li className="more-tasks">+{group.tasks.length - 4} more</li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>
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
                    <div className="document-meta-tags">
                      {generatedProjectDocs.includes(doc.filename) && (
                        <span className="status-tag status-complete">
                          Project generated
                        </span>
                      )}
                      <span className="upload-time">
                        {formatDate(doc.uploaded_at)}
                      </span>
                    </div>
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

      </div>

      {generationModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!progressModalOpen) {
              closeGenerationModal();
            }
          }}
        >
          <div
            className="modal-content edit-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>
                <span className="heading-icon">
                  <Icon name="tasks" size={18} />
                </span>
                AI Project & Task Generator
              </h3>
              <button
                onClick={closeGenerationModal}
                className="modal-close"
                aria-label="Close generation modal"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <form onSubmit={handleGenerationSubmit}>
              <div className="modal-body">
                {!hasValidDocuments || !hasSelectableProjects ? (
                  <div className="empty-state">
                    <p>
                      Upload at least one document and create a project to use the AI generator.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="form-group">
                      <label htmlFor="generation-document">Source Document *</label>
                      <select
                        id="generation-document"
                        value={selectedGenerationDocument}
                        onChange={(e) => setSelectedGenerationDocument(e.target.value)}
                        required
                      >
                        {uploadedFiles
                          .filter((doc) => doc.filename && doc.filename !== "Unknown")
                          .map((doc) => (
                            <option key={doc.filename} value={doc.filename}>
                              {doc.filename}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="form-group toggle-group">
                      <label>Generation Options</label>
                      <div className="toggle-row">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={shouldGenerateProject}
                            onChange={(e) => setShouldGenerateProject(e.target.checked)}
                            disabled={generatedProjectDocs.includes(selectedGenerationDocument)}
                          />
                          <span>Generate project brief</span>
                        </label>
                        {generatedProjectDocs.includes(selectedGenerationDocument) && (
                          <span className="hint-text">Project already created for this document</span>
                        )}
                      </div>
                      <div className="toggle-row">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={shouldGenerateTasks}
                            onChange={(e) => setShouldGenerateTasks(e.target.checked)}
                          />
                          <span>Generate tasks for selected projects</span>
                        </label>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Target Projects</label>
                      <div className="checkbox-grid">
                        {projects
                          .filter((project) => project.id)
                          .map((project) => {
                            const projectId = project.id!.toString();
                            const checked = selectedGenerationProjects.includes(projectId);
                            return (
                              <label className="checkbox-label" key={project.id}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    setSelectedGenerationProjects((previous) => {
                                      if (checked) {
                                        return previous.filter((id) => id !== projectId);
                                      }
                                      return [...previous, projectId];
                                    });
                                  }}
                                  disabled={!shouldGenerateTasks}
                                />
                                <span>{project.name}</span>
                              </label>
                            );
                          })}
                      </div>
                      <p className="hint-text">
                        Tasks are saved as proposed items. Accept them from the Schedule page.
                      </p>
                    </div>

                    <div className="form-group">
                      <label htmlFor="generation-max-tasks">
                        Maximum tasks per project (1-20)
                      </label>
                      <input
                        type="number"
                        id="generation-max-tasks"
                        min={1}
                        max={20}
                        value={generationMaxTasks}
                        onChange={(e) => {
                          const nextValue = parseInt(e.target.value, 10);
                          if (Number.isNaN(nextValue)) {
                            setGenerationMaxTasks(1);
                          } else {
                            setGenerationMaxTasks(Math.max(1, Math.min(20, nextValue)));
                          }
                        }}
                        disabled={!shouldGenerateTasks}
                      />
                    </div>

                    {generationError && (
                      <div className="error-message">{generationError}</div>
                    )}
                  </>
                )}
              </div>
              <div className="modal-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!hasValidDocuments || !hasSelectableProjects}
                >
                  Start Generation
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeGenerationModal}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {progressModalOpen && (
        <div className="modal-overlay" onClick={() => closeProgressModal()}>
          <div
            className="modal-content progress-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>
                <span className="heading-icon">
                  <Icon name="ai" size={18} />
                </span>
                ConstructIQ is working
              </h3>
              <button
                onClick={closeProgressModal}
                className="modal-close"
                aria-label="Close progress"
                disabled={!generationComplete}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="progress-steps">
                {progressSteps.map((step) => (
                  <div
                    key={step.id}
                    className={`progress-step ${step.status}`}
                  >
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

              {generationComplete && generationError && (
                <div className="error-message" style={{ marginTop: "1rem" }}>
                  {generationError}
                </div>
              )}
              {generationComplete && generationSuccess && (
                <div className="success-message" style={{ marginTop: "1rem" }}>
                  {generationSuccess}
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={closeProgressModal}
                disabled={!generationComplete}
              >
                {generationComplete ? "Close" : "Working..."}
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}

export default ConstructIQ;
