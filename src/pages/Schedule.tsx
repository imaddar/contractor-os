import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { schedulesApi, type Schedule } from "../api/schedules";
import { projectsApi, type Project } from "../api/projects";
import { subcontractorsApi, type Subcontractor } from "../api/subcontractors";
import Calendar from "../components/Calendar";
import EditModal from "../components/EditModal";
import DeleteModal from "../components/DeleteModal";
import { Icon } from "../components/Icon";
import ScheduleTimeline from "../components/ScheduleTimeline";
import ResourceLoadChart, {
  type ResourceLoadDatum,
} from "../components/ResourceLoadChart";

interface ScheduleFormState {
  project_id: string;
  task_name: string;
  start_date: string;
  end_date: string;
  assigned_to: string;
  status: string;
  predecessor_ids: number[];
  progress_percent: number;
  resource_capacities: Record<string, number>;
}

interface ResourceLoadSummary {
  subcontractorId: number;
  peakLoad: number;
  hasConflict: boolean;
  conflictTaskIds: number[];
}

const parseDate = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

const startOfDay = (date: Date): number => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

const endOfDayExclusive = (date: Date): number => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
};

const normalizeSchedule = (schedule: Schedule): Schedule => {
  const predecessors = Array.isArray(schedule.predecessor_ids)
    ? schedule.predecessor_ids
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
    : [];

  const resourceCapacitiesSource = schedule.resource_capacities ?? {};
  const resourceCapacities: Record<string, number> = {};
  Object.entries(resourceCapacitiesSource).forEach(([key, rawValue]) => {
    const numeric = typeof rawValue === "number" ? rawValue : Number(rawValue);
    if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
      resourceCapacities[key] = numeric;
    }
  });

  const progressValue =
    typeof schedule.progress_percent === "number" && Number.isFinite(schedule.progress_percent)
      ? Math.min(100, Math.max(0, schedule.progress_percent))
      : 0;

  return {
    ...schedule,
    predecessor_ids: predecessors,
    resource_capacities: resourceCapacities,
    progress_percent: progressValue,
  };
};

const calculateResourceLoads = (schedules: Schedule[]): ResourceLoadSummary[] => {
  interface AllocationWindow {
    taskId?: number;
    allocation: number;
    start: number | null;
    end: number | null;
  }

  const allocationMap = new Map<number, AllocationWindow[]>();

  schedules.forEach((schedule) => {
    if (!schedule.resource_capacities) {
      return;
    }

    Object.entries(schedule.resource_capacities).forEach(([key, rawValue]) => {
      const subcontractorId = Number(key);
      const allocation = typeof rawValue === "number" ? rawValue : Number(rawValue);

      if (!Number.isFinite(subcontractorId) || !Number.isFinite(allocation)) {
        return;
      }

      const startDate = parseDate(schedule.start_date);
      const endDate = parseDate(schedule.end_date);

      const window: AllocationWindow = {
        taskId: schedule.id,
        allocation,
        start: startDate && endDate ? startOfDay(startDate) : null,
        end: startDate && endDate ? endOfDayExclusive(endDate) : null,
      };

      const existing = allocationMap.get(subcontractorId);
      if (existing) {
        existing.push(window);
      } else {
        allocationMap.set(subcontractorId, [window]);
      }
    });
  });

  const summaries: ResourceLoadSummary[] = [];

  allocationMap.forEach((windows, subcontractorId) => {
    if (!windows.length) {
      return;
    }

    const dated = windows.filter((window) => window.start !== null && window.end !== null);
    const undated = windows.filter((window) => window.start === null || window.end === null);

    const conflictingTaskIds = new Set<number>();
    const activeTasks = new Map<number, number>();

    let currentLoad = 0;

    undated.forEach((window) => {
      currentLoad += window.allocation;
      if (typeof window.taskId === "number") {
        activeTasks.set(window.taskId, window.allocation);
      }
    });

    if (currentLoad > 100) {
      activeTasks.forEach((_, taskId) => {
        conflictingTaskIds.add(taskId);
      });
    }

    const events: { time: number; type: "start" | "end"; allocation: number; taskId?: number }[] = [];

    dated.forEach((window) => {
      events.push({
        time: window.start as number,
        type: "start",
        allocation: window.allocation,
        taskId: window.taskId,
      });
      events.push({
        time: window.end as number,
        type: "end",
        allocation: window.allocation,
        taskId: window.taskId,
      });
    });

    events.sort((a, b) => {
      if (a.time === b.time) {
        if (a.type === b.type) {
          return 0;
        }
        return a.type === "start" ? -1 : 1;
      }
      return a.time - b.time;
    });

    let peakLoad = currentLoad;

    events.forEach((event) => {
      if (event.type === "start") {
        currentLoad += event.allocation;
        if (typeof event.taskId === "number") {
          activeTasks.set(event.taskId, event.allocation);
        }
        if (currentLoad > 100) {
          activeTasks.forEach((_, taskId) => {
            conflictingTaskIds.add(taskId);
          });
        }
        peakLoad = Math.max(peakLoad, currentLoad);
      } else {
        if (typeof event.taskId === "number") {
          activeTasks.delete(event.taskId);
        }
        currentLoad -= event.allocation;
        if (currentLoad < 0) {
          currentLoad = 0;
        }
        peakLoad = Math.max(peakLoad, currentLoad);
      }
    });

    const hasConflict = conflictingTaskIds.size > 0 || peakLoad > 100;

    summaries.push({
      subcontractorId,
      peakLoad: Number(peakLoad.toFixed(2)),
      hasConflict,
      conflictTaskIds: Array.from(conflictingTaskIds),
    });
  });

  return summaries;
};

const SchedulePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"calendar" | "list" | "timeline">(
    "calendar",
  );
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(
    null,
  );
  const [formData, setFormData] = useState<ScheduleFormState>({
    project_id: "",
    task_name: "",
    start_date: "",
    end_date: "",
    assigned_to: "",
    status: "pending",
    predecessor_ids: [],
    progress_percent: 0,
    resource_capacities: {},
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [deletingSchedule, setDeletingSchedule] = useState<Schedule | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [proposedTasks, setProposedTasks] = useState<Schedule[]>([]);
  const [showProposedModal, setShowProposedModal] = useState(false);
  const [processingProposalId, setProcessingProposalId] = useState<
    number | null
  >(null);
  const [proposalError, setProposalError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // Check if we should open the modal from URL parameter
    if (searchParams.get("action") === "new") {
      setShowEditModal(true);
      // Remove only the action param while preserving other query params
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("action");
      setSearchParams(nextParams);
    }
  }, [searchParams, setSearchParams]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [schedulesData, projectsData, subcontractorsData] =
        await Promise.all([
          schedulesApi.getAll(),
          projectsApi.getAll(),
          subcontractorsApi.getAll(),
        ]);
      const normalizedSchedules = schedulesData.map(normalizeSchedule);
      const proposed = normalizedSchedules.filter(
        (task) => task.status === "proposed",
      );
      const activeSchedules = normalizedSchedules.filter(
        (task) => task.status !== "proposed",
      );
      setSchedules(activeSchedules);
      setProposedTasks(proposed);
      setProposalError(null);
      setProjects(projectsData);
      setSubcontractors(subcontractorsData);
    } catch (err) {
      setError("Failed to fetch data");
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const scheduleLookup = useMemo(() => {
    const lookup = new Map<number, Schedule>();
    schedules.forEach((schedule) => {
      if (typeof schedule.id === "number") {
        lookup.set(schedule.id, schedule);
      }
    });
    return lookup;
  }, [schedules]);

  const handleEdit = (schedule: Schedule) => {
    const normalized = normalizeSchedule(schedule);
    setEditingSchedule(normalized);
    setFormData({
      project_id: normalized.project_id.toString(),
      task_name: normalized.task_name,
      start_date: normalized.start_date || "",
      end_date: normalized.end_date || "",
      assigned_to: normalized.assigned_to
        ? normalized.assigned_to.toString()
        : "",
      status: normalized.status,
      predecessor_ids: normalized.predecessor_ids ?? [],
      progress_percent: normalized.progress_percent ?? 0,
      resource_capacities: normalized.resource_capacities ?? {},
    });
    setShowEditModal(true);
    setSelectedSchedule(null);
  };

  const handleDelete = (schedule: Schedule) => {
    setDeletingSchedule(schedule);
    setShowDeleteModal(true);
    setSelectedSchedule(null);
    setError(null); // Clear any previous errors
  };

  const confirmDelete = async () => {
    if (!deletingSchedule) return;

    try {
      setIsSubmitting(true);
      console.log("Deleting schedule:", deletingSchedule.id);
      await schedulesApi.delete(deletingSchedule.id!);
      console.log("Schedule deleted successfully");
      await fetchData(); // Refresh all data
      setShowDeleteModal(false);
      setDeletingSchedule(null);
      setError(null);
    } catch (err: unknown) {
      console.error("Error deleting schedule:", err);
      const message =
        err instanceof Error ? err.message : "Failed to delete schedule";
      setError(message);
      // Keep modal open to show error
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDeletingSchedule(null);
    setError(null);
  };

  const acceptProposedTask = async (task: Schedule) => {
    if (!task.id) return;
    try {
      setProcessingProposalId(task.id);
      setProposalError(null);
      await schedulesApi.update(task.id, {
        project_id: task.project_id,
        task_name: task.task_name,
        start_date: task.start_date || undefined,
        end_date: task.end_date || undefined,
        assigned_to: task.assigned_to ?? undefined,
        status: "pending",
        predecessor_ids: task.predecessor_ids ?? [],
        resource_capacities: task.resource_capacities ?? {},
        progress_percent: task.progress_percent ?? 0,
      });
      await fetchData();
    } catch (err) {
      console.error("Error accepting proposed task:", err);
      setProposalError(
        err instanceof Error
          ? err.message
          : "Failed to accept the proposed task",
      );
    } finally {
      setProcessingProposalId(null);
    }
  };

  const rejectProposedTask = async (task: Schedule) => {
    if (!task.id) return;
    try {
      setProcessingProposalId(task.id);
      setProposalError(null);
      await schedulesApi.delete(task.id);
      await fetchData();
    } catch (err) {
      console.error("Error rejecting proposed task:", err);
      setProposalError(
        err instanceof Error
          ? err.message
          : "Failed to reject the proposed task",
      );
    } finally {
      setProcessingProposalId(null);
    }
  };

  const closeProposedModal = () => {
    if (processingProposalId !== null) {
      return;
    }
    setShowProposedModal(false);
    setProposalError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const progress = Math.min(
        100,
        Math.max(0, Number(formData.progress_percent ?? 0)),
      );
      const resourceCapacities: Record<string, number> = {};
      Object.entries(formData.resource_capacities).forEach(([key, value]) => {
        if (value === undefined || value === null) {
          return;
        }
        const numeric = Number(value);
        if (!Number.isNaN(numeric) && Number.isFinite(numeric) && numeric > 0) {
          resourceCapacities[key] = numeric;
        }
      });

      const scheduleData = {
        project_id: parseInt(formData.project_id, 10),
        task_name: formData.task_name,
        start_date: formData.start_date || undefined,
        end_date: formData.end_date || undefined,
        assigned_to: formData.assigned_to
          ? parseInt(formData.assigned_to, 10)
          : undefined,
        status: formData.status,
        predecessor_ids: formData.predecessor_ids,
        resource_capacities: resourceCapacities,
        progress_percent: progress,
      };

      if (editingSchedule) {
        await schedulesApi.update(editingSchedule.id!, scheduleData);
      } else {
        await schedulesApi.create(scheduleData);
      }

      await fetchData();
      resetForm();
    } catch (err) {
      setError(
        editingSchedule
          ? "Failed to update schedule"
          : "Failed to create schedule",
      );
      console.error("Error saving schedule:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      project_id: "",
      task_name: "",
      start_date: "",
      end_date: "",
      assigned_to: "",
      status: "pending",
      predecessor_ids: [],
      progress_percent: 0,
      resource_capacities: {},
    });
    setEditingSchedule(null);
    setShowEditModal(false);
  };

  const getProjectName = useCallback(
    (projectId: number) => {
      const project = projects.find((p) => p.id === projectId);
      return project ? project.name : "Unknown Project";
    },
    [projects],
  );

  const getSubcontractorName = useCallback(
    (subcontractorId: number) => {
      const subcontractor = subcontractors.find((s) => s.id === subcontractorId);
      return subcontractor ? subcontractor.name : "Unassigned";
    },
    [subcontractors],
  );

  const getDependencyNames = (schedule: Schedule): string[] => {
    if (!schedule.predecessor_ids || schedule.predecessor_ids.length === 0) {
      return [];
    }
    return schedule.predecessor_ids
      .map((id) => {
        const dependency = scheduleLookup.get(id);
        return dependency ? dependency.task_name : null;
      })
      .filter((value): value is string => Boolean(value));
  };

  const resourceSummaries = useMemo<ResourceLoadSummary[]>(() => {
    return calculateResourceLoads(schedules);
  }, [schedules]);

  const conflictTaskIdSet = useMemo(() => {
    const ids = new Set<number>();
    resourceSummaries.forEach((summary) => {
      summary.conflictTaskIds.forEach((taskId) => {
        ids.add(taskId);
      });
    });
    return ids;
  }, [resourceSummaries]);

  const overallocatedLoads = useMemo(() => {
    return resourceSummaries.filter((summary) => summary.hasConflict);
  }, [resourceSummaries]);

  const resourceChartData = useMemo<ResourceLoadDatum[]>(() => {
    return [...resourceSummaries]
      .sort((a, b) => b.peakLoad - a.peakLoad)
      .map((summary) => ({
        subcontractorId: summary.subcontractorId,
        subcontractorName: getSubcontractorName(summary.subcontractorId),
        peakLoad: summary.peakLoad,
        hasConflict: summary.hasConflict,
        conflictTaskIds: summary.conflictTaskIds,
      }));
  }, [resourceSummaries, getSubcontractorName]);

  const handleEventClick = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
  };

  const handleDateClick = (date: Date) => {
    const dateString = date.toISOString().split("T")[0];
    setFormData((prev) => ({ ...prev, start_date: dateString }));
  };

  const handlePredecessorsChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const selected = Array.from(event.target.selectedOptions)
      .map((option) => Number(option.value))
      .filter((value) => Number.isFinite(value));
    setFormData((prev) => ({
      ...prev,
      predecessor_ids: selected,
    }));
  };

  const handleResourceCapacityChange = (
    subcontractorId: number,
    value: string,
  ) => {
    const numeric = Number(value);
    setFormData((prev) => {
      const next = { ...prev.resource_capacities };
      if (!value || Number.isNaN(numeric) || numeric <= 0) {
        delete next[subcontractorId.toString()];
      } else {
        next[subcontractorId.toString()] = numeric;
      }
      return {
        ...prev,
        resource_capacities: next,
      };
    });
  };

  const closeModal = () => {
    setSelectedSchedule(null);
  };

  if (loading) return <div className="page-content">Loading...</div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Schedule</h1>
        <div className="header-controls">
          <div className="view-toggle">
            <button
              className={`toggle-btn ${viewMode === "calendar" ? "active" : ""}`}
              onClick={() => setViewMode("calendar")}
            >
              <Icon name="calendar" size={16} />
              <span>Calendar</span>
            </button>
            <button
              className={`toggle-btn ${viewMode === "list" ? "active" : ""}`}
              onClick={() => setViewMode("list")}
            >
              <Icon name="tasks" size={16} />
              <span>List</span>
            </button>
            <button
              className={`toggle-btn ${viewMode === "timeline" ? "active" : ""}`}
              onClick={() => setViewMode("timeline")}
            >
              <Icon name="timeline" size={16} />
              <span>Timeline</span>
            </button>
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setShowProposedModal(true);
              setProposalError(null);
            }}
            disabled={proposedTasks.length === 0}
          >
            <Icon name="tasks" size={16} />
            <span style={{ marginLeft: "0.5rem" }}>
              Review Proposed Tasks
              {proposedTasks.length > 0 ? ` (${proposedTasks.length})` : ""}
            </span>
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowEditModal(true)}
          >
            New Task
          </button>
        </div>
      </div>

      {error && !showDeleteModal && !showEditModal && (
        <div className="error-message">{error}</div>
      )}

      {overallocatedLoads.length > 0 && (
        <div className="warning-banner">
          <div className="warning-banner-icon">
            <Icon name="warning" size={18} />
          </div>
          <div className="warning-banner-content">
            <strong>Resource conflicts detected</strong>
            <ul>
              {overallocatedLoads.map((load) => (
                <li key={load.subcontractorId}>
                  {getSubcontractorName(load.subcontractorId)} peak load{" "}
                  {Math.round(load.peakLoad)}%
                </li>
              ))}
            </ul>
            <p>Review the timeline or adjust capacities to resolve conflicts.</p>
          </div>
        </div>
      )}

      {viewMode === "calendar" ? (
        <Calendar
          schedules={schedules}
          projects={projects}
          onDateClick={handleDateClick}
          onEventClick={handleEventClick}
        />
      ) : viewMode === "list" ? (
        <div className="schedule-list">
          {schedules.length === 0 ? (
            <div className="empty-state">
              <p>
                No scheduled tasks found. Add your first task to get started!
              </p>
            </div>
          ) : (
            <div className="projects-grid">
              {schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className={`project-card ${
                    typeof schedule.id === "number" &&
                    conflictTaskIdSet.has(schedule.id)
                      ? "conflict"
                      : ""
                  }`}
                >
                  <div className="project-header">
                    <h3>{schedule.task_name}</h3>
                    <span className={`status ${schedule.status}`}>
                      {schedule.status}
                    </span>
                  </div>

                  <div className="project-details">
                    <div className="detail">
                      <strong>Progress:</strong>{" "}
                      {Math.round(schedule.progress_percent ?? 0)}%
                    </div>
                    <div className="detail">
                      <strong>Project:</strong>{" "}
                      {getProjectName(schedule.project_id)}
                    </div>
                    {schedule.start_date && (
                      <div className="detail">
                        <strong>Start:</strong>{" "}
                        {new Date(schedule.start_date).toLocaleDateString()}
                      </div>
                    )}
                    {schedule.end_date && (
                      <div className="detail">
                        <strong>End:</strong>{" "}
                        {new Date(schedule.end_date).toLocaleDateString()}
                      </div>
                    )}
                    {schedule.assigned_to && (
                      <div className="detail">
                        <strong>Assigned to:</strong>{" "}
                        {getSubcontractorName(schedule.assigned_to)}
                      </div>
                    )}
                    {(() => {
                      const dependencies = getDependencyNames(schedule);
                      if (dependencies.length === 0) {
                        return null;
                      }
                      return (
                        <div className="detail">
                          <strong>Predecessors:</strong>{" "}
                          {dependencies.join(", ")}
                        </div>
                      );
                    })()}
                    {schedule.resource_capacities &&
                      Object.keys(schedule.resource_capacities).length > 0 && (
                        <div className="detail">
                          <strong>Resources:</strong>{" "}
                          {Object.entries(schedule.resource_capacities)
                            .map(([key, value]) => {
                              const name = getSubcontractorName(Number(key));
                              return `${name} (${Math.round(Number(value))}%)`;
                            })
                            .join(", ")}
                        </div>
                      )}
                    {typeof schedule.id === "number" &&
                      conflictTaskIdSet.has(schedule.id) && (
                        <div className="detail conflict-detail">
                          <Icon name="warning" size={14} />
                          <span>
                            Overallocated resource. Adjust dependencies or
                            assignments.
                          </span>
                        </div>
                      )}
                  </div>

                  <div className="project-actions">
                    <button
                      className="btn btn-small btn-secondary"
                      onClick={() => handleEdit(schedule)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-small btn-danger"
                      onClick={() => handleDelete(schedule)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="timeline-view">
          <ScheduleTimeline
            schedules={schedules}
            projects={projects}
            subcontractors={subcontractors}
            conflictTaskIds={conflictTaskIdSet}
          />
          <ResourceLoadChart loads={resourceChartData} />
        </div>
      )}

      {selectedSchedule && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedSchedule.task_name}</h3>
              <button onClick={closeModal} className="modal-close">
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="detail">
                <strong>Project:</strong>{" "}
                {getProjectName(selectedSchedule.project_id)}
              </div>
              <div className="detail">
                <strong>Status:</strong>
                <span className={`status ${selectedSchedule.status}`}>
                  {selectedSchedule.status}
                </span>
              </div>
              <div className="detail">
                <strong>Progress:</strong>{" "}
                {Math.round(selectedSchedule.progress_percent ?? 0)}%
              </div>
              {selectedSchedule.start_date && (
                <div className="detail">
                  <strong>Start Date:</strong>{" "}
                  {selectedSchedule.start_date
                    ? new Date(selectedSchedule.start_date).toLocaleDateString()
                    : ""}
                </div>
              )}
              {selectedSchedule.end_date && (
                <div className="detail">
                  <strong>End Date:</strong>{" "}
                  {new Date(selectedSchedule.end_date).toLocaleDateString()}
                </div>
              )}
              {selectedSchedule.assigned_to && (
                <div className="detail">
                  <strong>Assigned to:</strong>{" "}
                  {getSubcontractorName(selectedSchedule.assigned_to)}
                </div>
              )}
              {(() => {
                const dependencies = getDependencyNames(selectedSchedule);
                if (dependencies.length === 0) {
                  return null;
                }
                return (
                  <div className="detail">
                    <strong>Predecessors:</strong>{" "}
                    {dependencies.join(", ")}
                  </div>
                );
              })()}
              {selectedSchedule.resource_capacities &&
                Object.keys(selectedSchedule.resource_capacities).length > 0 && (
                  <div className="detail">
                    <strong>Resources:</strong>{" "}
                    {Object.entries(selectedSchedule.resource_capacities)
                      .map(([key, value]) => {
                        const name = getSubcontractorName(Number(key));
                        return `${name} (${Math.round(Number(value))}%)`;
                      })
                      .join(", ")}
                  </div>
                )}
              {typeof selectedSchedule.id === "number" &&
                conflictTaskIdSet.has(selectedSchedule.id) && (
                  <div className="detail conflict-detail">
                    <Icon name="warning" size={14} />
                    <span>
                      Resource load exceeds capacity. Consider rescheduling.
                    </span>
                  </div>
                )}
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => handleEdit(selectedSchedule)}
              >
                Edit
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleDelete(selectedSchedule)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showProposedModal && (
        <div className="modal-overlay" onClick={closeProposedModal}>
          <div
            className="modal-content edit-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Review Proposed Tasks</h3>
              <button
                onClick={closeProposedModal}
                className="modal-close"
                aria-label="Close proposed tasks"
                disabled={processingProposalId !== null}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              {proposalError && (
                <div className="error-message" style={{ marginBottom: "1rem" }}>
                  {proposalError}
                </div>
              )}
              {proposedTasks.length === 0 ? (
                <div className="empty-state">
                  <p>All proposed tasks have been addressed.</p>
                </div>
              ) : (
                <div className="projects-grid">
                  {proposedTasks.map((task) => {
                    const isProcessing = processingProposalId === task.id;
                    const isBusy = processingProposalId !== null;
                    return (
                      <div className="project-card" key={task.id}>
                        <div className="project-header">
                          <h3>{task.task_name}</h3>
                          <span className={`status ${task.status}`}>
                            {task.status}
                          </span>
                        </div>
                        <div className="project-details">
                          <div className="detail">
                            <strong>Project:</strong>{" "}
                            {getProjectName(task.project_id)}
                          </div>
                          <div className="detail">
                            <strong>Start:</strong>{" "}
                            {task.start_date
                              ? new Date(task.start_date).toLocaleDateString()
                              : "TBD"}
                          </div>
                          <div className="detail">
                            <strong>End:</strong>{" "}
                            {task.end_date
                              ? new Date(task.end_date).toLocaleDateString()
                              : "TBD"}
                          </div>
                          <div className="detail">
                            <strong>Assigned:</strong>{" "}
                            {task.assigned_to
                              ? getSubcontractorName(task.assigned_to)
                              : "Unassigned"}
                          </div>
                        </div>
                        <div className="project-actions">
                          <button
                            className="btn btn-small btn-primary"
                            onClick={() => acceptProposedTask(task)}
                            disabled={isBusy}
                          >
                            {isProcessing && processingProposalId === task.id
                              ? "Accepting..."
                              : "Accept"}
                          </button>
                          <button
                            className="btn btn-small btn-secondary"
                            onClick={() => rejectProposedTask(task)}
                            disabled={isBusy}
                          >
                            {isProcessing && processingProposalId === task.id
                              ? "Discarding..."
                              : "Discard"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeProposedModal}
                disabled={processingProposalId !== null}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <EditModal
        isOpen={showEditModal}
        title={editingSchedule ? "Edit Schedule Task" : "Add Schedule Task"}
        onClose={resetForm}
        onSubmit={handleSubmit}
        submitText={editingSchedule ? "Update Task" : "Add Task"}
        isLoading={isSubmitting}
      >
        <div className="form-group">
          <label htmlFor="project_id">Project *</label>
          <select
            id="project_id"
            value={formData.project_id}
            onChange={(e) =>
              setFormData({ ...formData, project_id: e.target.value })
            }
            required
          >
            <option value="">Select a project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="task_name">Task Name *</label>
          <input
            type="text"
            id="task_name"
            value={formData.task_name}
            onChange={(e) =>
              setFormData({ ...formData, task_name: e.target.value })
            }
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="start_date">Start Date</label>
            <input
              type="date"
              id="start_date"
              value={formData.start_date}
              onChange={(e) =>
                setFormData({ ...formData, start_date: e.target.value })
              }
            />
          </div>

          <div className="form-group">
            <label htmlFor="end_date">End Date</label>
            <input
              type="date"
              id="end_date"
              value={formData.end_date}
              onChange={(e) =>
                setFormData({ ...formData, end_date: e.target.value })
              }
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="assigned_to">Assigned To</label>
            <select
              id="assigned_to"
              value={formData.assigned_to}
              onChange={(e) =>
                setFormData({ ...formData, assigned_to: e.target.value })
              }
            >
              <option value="">Unassigned</option>
              {subcontractors.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="status">Status</label>
            <select
              id="status"
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value })
              }
            >
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="delayed">Delayed</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="predecessor_ids">Predecessors</label>
          <select
            id="predecessor_ids"
            multiple
            value={formData.predecessor_ids.map((id) => id.toString())}
            onChange={handlePredecessorsChange}
          >
            {schedules
              .filter((existing) =>
                editingSchedule?.id
                  ? existing.id !== editingSchedule.id
                  : true,
              )
              .map((existing) => {
                if (typeof existing.id !== "number") {
                  return null;
                }
                return (
                  <option key={existing.id} value={existing.id}>
                    {existing.task_name}
                  </option>
                );
              })}
          </select>
          <small className="form-hint">
            Hold Ctrl (Cmd on macOS) to choose multiple dependency tasks.
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="progress_percent">Progress</label>
          <div className="progress-input">
            <input
              type="range"
              id="progress_percent"
              min={0}
              max={100}
              value={formData.progress_percent}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  progress_percent: Number(e.target.value),
                })
              }
            />
            <span>{Math.round(formData.progress_percent)}%</span>
          </div>
        </div>

        <div className="form-group">
          <label>Resource capacities (% allocation)</label>
          <div className="resource-capacity-grid">
            {subcontractors
              .filter((sub) => typeof sub.id === "number")
              .map((sub) => {
                const subcontractorId = sub.id as number;
                const storedValue =
                  formData.resource_capacities[
                    subcontractorId.toString()
                  ];
                return (
                  <div className="resource-capacity-row" key={subcontractorId}>
                    <span>{sub.name}</span>
                    <input
                      type="number"
                      min={0}
                      max={200}
                      step={5}
                      value={storedValue ?? ""}
                      onChange={(e) =>
                        handleResourceCapacityChange(
                          subcontractorId,
                          e.target.value,
                        )
                      }
                    />
                  </div>
                );
              })}
          </div>
          <small className="form-hint">
            Allocate capacity per subcontractor to power conflict detection.
          </small>
        </div>
      </EditModal>

      <DeleteModal
        isOpen={showDeleteModal}
        title="Delete Schedule Task"
        message="Are you sure you want to delete this scheduled task?"
        itemName={deletingSchedule?.task_name || ""}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        isLoading={isSubmitting}
        error={error}
      />
    </div>
  );
};

export default SchedulePage;
