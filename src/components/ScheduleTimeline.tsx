import React, { useMemo } from "react";
import type { Schedule } from "../api/schedules";
import type { Project } from "../api/projects";
import type { Subcontractor } from "../api/subcontractors";

interface TimelineTask {
  schedule: Schedule;
  start: number;
  endExclusive: number;
  projectName: string;
  subcontractorName: string;
}

interface ScheduleTimelineProps {
  schedules: Schedule[];
  projects: Project[];
  subcontractors: Subcontractor[];
  conflictTaskIds: Set<number>;
}

const toStartOfDay = (value: string): number => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return Number.NaN;
  }
  const normalized = new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate(),
  );
  return normalized.getTime();
};

const toEndOfDayExclusive = (value: string): number => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return Number.NaN;
  }
  const normalized = new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate() + 1,
  );
  return normalized.getTime();
};

const MIN_BAR_WIDTH = 2;

const ScheduleTimeline: React.FC<ScheduleTimelineProps> = ({
  schedules,
  projects,
  subcontractors,
  conflictTaskIds,
}) => {
  const projectLookup = useMemo(() => {
    const lookup = new Map<number, string>();
    projects.forEach((project) => {
      if (project.id !== undefined) {
        lookup.set(project.id, project.name);
      }
    });
    return lookup;
  }, [projects]);

  const subcontractorLookup = useMemo(() => {
    const lookup = new Map<number, string>();
    subcontractors.forEach((subcontractor) => {
      if (subcontractor.id !== undefined) {
        lookup.set(subcontractor.id, subcontractor.name);
      }
    });
    return lookup;
  }, [subcontractors]);

  const timelineTasks = useMemo(() => {
    return schedules.reduce<TimelineTask[]>((accumulator, schedule) => {
      if (!schedule.start_date || !schedule.end_date) {
        return accumulator;
      }

      const start = toStartOfDay(schedule.start_date);
      const endExclusive = toEndOfDayExclusive(schedule.end_date);
      if (Number.isNaN(start) || Number.isNaN(endExclusive) || start >= endExclusive) {
        return accumulator;
      }

      const projectName = projectLookup.get(schedule.project_id) || "Unknown Project";
      const subcontractorName =
        (schedule.assigned_to && subcontractorLookup.get(schedule.assigned_to)) || "Unassigned";

      accumulator.push({
        schedule,
        start,
        endExclusive,
        projectName,
        subcontractorName,
      });
      return accumulator;
    }, []);
  }, [projectLookup, schedules, subcontractorLookup]);

  const unscheduledTasks = useMemo(() => {
    return schedules.filter((schedule) => {
      if (!schedule.start_date || !schedule.end_date) {
        return true;
      }
      const start = toStartOfDay(schedule.start_date);
      const endExclusive = toEndOfDayExclusive(schedule.end_date);
      return Number.isNaN(start) || Number.isNaN(endExclusive) || start >= endExclusive;
    });
  }, [schedules]);

  const [minStart, maxEndExclusive] = useMemo(() => {
    if (timelineTasks.length === 0) {
      return [Number.NaN, Number.NaN];
    }
    const startValues = timelineTasks.map((item) => item.start);
    const endValues = timelineTasks.map((item) => item.endExclusive);
    return [Math.min(...startValues), Math.max(...endValues)];
  }, [timelineTasks]);

  const totalDuration =
    Number.isNaN(minStart) || Number.isNaN(maxEndExclusive) || minStart === maxEndExclusive
      ? 1
      : maxEndExclusive - minStart;

  if (timelineTasks.length === 0) {
    return (
      <div className="timeline-empty">
        <p>No tasks with start and end dates to render on the timeline.</p>
      </div>
    );
  }

  return (
    <div className="timeline-container">
      <div className="timeline-grid">
        {timelineTasks.map((task) => {
          const scheduleId = task.schedule.id;
          const offset = ((task.start - minStart) / totalDuration) * 100;
          const width = ((task.endExclusive - task.start) / totalDuration) * 100;
          const progress = Math.min(100, Math.max(0, task.schedule.progress_percent ?? 0));
          const clampedWidth = Number.isFinite(width) ? Math.max(width, MIN_BAR_WIDTH) : MIN_BAR_WIDTH;
          const isConflict =
            typeof scheduleId === "number" && conflictTaskIds.has(scheduleId);

          return (
            <div className="timeline-row" key={scheduleId ?? task.schedule.task_name}>
              <div className="timeline-row-info">
                <div className="timeline-task-name">{task.schedule.task_name}</div>
                <div className="timeline-task-meta">
                  <span>{task.projectName}</span>
                  <span>•</span>
                  <span>{task.subcontractorName}</span>
                </div>
                <div className="timeline-task-dates">
                  {task.schedule.start_date} → {task.schedule.end_date}
                </div>
              </div>
              <div className="timeline-track">
                <div
                  className={`timeline-bar ${isConflict ? "conflict" : ""}`}
                  style={{
                    left: `${offset}%`,
                    width: `${clampedWidth}%`,
                  }}
                  aria-label={`${task.schedule.task_name} (${task.projectName})`}
                >
                  <div
                    className="timeline-bar-progress"
                    style={{ width: `${progress}%` }}
                    aria-hidden
                  ></div>
                  <span className="timeline-bar-progress-label">{progress.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {unscheduledTasks.length > 0 && (
        <div className="timeline-unscheduled">
          <h4>Tasks missing schedule dates</h4>
          <ul>
            {unscheduledTasks.map((task) => (
              <li key={task.id ?? task.task_name}>{task.task_name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ScheduleTimeline;
