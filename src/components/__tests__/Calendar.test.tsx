import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Calendar from "../Calendar";
import type { Schedule } from "../../api/schedules";
import type { Project } from "../../api/projects";

const baseProject: Project = {
  id: 1,
  name: "Main Build",
  status: "active",
};

const renderCalendar = (schedules: Schedule[]) => {
  return render(
    <Calendar
      schedules={schedules}
      projects={[baseProject]}
      onDateClick={vi.fn()}
      onEventClick={vi.fn()}
    />,
  );
};

describe("Calendar", () => {
  it("renders tasks that only have a start date as single-day entries", async () => {
    const todayIso = new Date().toISOString().split("T")[0];
    const singleDayTask: Schedule = {
      id: 101,
      project_id: baseProject.id!,
      task_name: "Punch List Review",
      start_date: todayIso,
      status: "pending",
    };

    renderCalendar([singleDayTask]);

    expect(await screen.findByText("Punch List Review")).toBeInTheDocument();
  });

  it("ignores tasks without a valid start date", async () => {
    const missingStartDateTask: Schedule = {
      id: 202,
      project_id: baseProject.id!,
      task_name: "Undefined Start Task",
      status: "pending",
    };

    renderCalendar([missingStartDateTask]);

    expect(
      screen.queryByText("Undefined Start Task"),
    ).not.toBeInTheDocument();
  });
});
