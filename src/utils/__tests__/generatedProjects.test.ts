import { describe, expect, it } from "vitest";
import type { GeneratedProjectRecord } from "../generatedProjects";
import {
  addOrUpdateGeneratedProjectRecord,
  parseStoredGeneratedProjects,
  pruneGeneratedProjectRecords,
} from "../generatedProjects";

describe("generated project helpers", () => {
  it("adds a new record using the canonical filename and preserves metadata", () => {
    const existing: GeneratedProjectRecord[] = [];

    const updated = addOrUpdateGeneratedProjectRecord(
      existing,
      "  Example.pdf  ",
      42,
      "Example Project",
    );

    expect(updated).toEqual([
      {
        filename: "Example.pdf",
        projectId: 42,
        projectName: "Example Project",
      },
    ]);
  });

  it("updates an existing record instead of duplicating it", () => {
    const existing: GeneratedProjectRecord[] = [
      { filename: "Report.pdf", projectId: 10, projectName: "Old" },
    ];

    const updated = addOrUpdateGeneratedProjectRecord(
      existing,
      "Report.pdf",
      11,
      "New",
    );

    expect(updated).toEqual([
      { filename: "Report.pdf", projectId: 11, projectName: "New" },
    ]);
  });

  it("migrates legacy local storage arrays of filenames", () => {
    const parsed = parseStoredGeneratedProjects([
      "Doc.pdf",
      123,
      null,
      "",
      " Another.pdf ",
    ]);

    expect(parsed).toEqual([
      { filename: "Doc.pdf", projectId: null, projectName: null },
      { filename: "Another.pdf", projectId: null, projectName: null },
    ]);
  });

  it("drops records whose associated project was deleted", () => {
    const existing: GeneratedProjectRecord[] = [
      { filename: "Keep.pdf", projectId: 1, projectName: "Keep" },
      { filename: "DropById.pdf", projectId: 2, projectName: "Gone" },
      { filename: "DropByName.pdf", projectName: "Removed" },
      { filename: "NoInfo.pdf" },
    ];

    const remaining = pruneGeneratedProjectRecords(existing, [
      { id: 1, name: "Keep" },
      { id: 3, name: "Renamed" },
    ]);

    expect(remaining).toEqual([
      { filename: "Keep.pdf", projectId: 1, projectName: "Keep" },
      { filename: "NoInfo.pdf" },
    ]);
  });
});
