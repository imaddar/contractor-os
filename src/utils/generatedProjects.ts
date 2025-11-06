export interface GeneratedProjectRecord {
  filename: string;
  projectId?: number | null;
  projectName?: string | null;
}

export interface SimpleProjectLike {
  id?: number | null;
  name?: string | null;
}

const normalizeFilename = (value: string): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeProjectName = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toNullableNumber = (value: unknown): number | null | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (value === null) {
    return null;
  }
  return undefined;
};

export function addOrUpdateGeneratedProjectRecord(
  records: GeneratedProjectRecord[],
  filename: string,
  projectId?: number | null,
  projectName?: string | null,
): GeneratedProjectRecord[] {
  const canonicalFilename = normalizeFilename(filename);
  if (!canonicalFilename) {
    return records;
  }

  const normalizedName = normalizeProjectName(projectName);
  const normalizedProjectId = toNullableNumber(projectId);
  const existingIndex = records.findIndex(
    (record) => record.filename === canonicalFilename,
  );

  if (existingIndex >= 0) {
    const existing = records[existingIndex];
    const nextProjectId = normalizedProjectId !== undefined
      ? normalizedProjectId
      : existing.projectId;
    const nextProjectName = normalizedName ?? existing.projectName ?? null;

    if (
      nextProjectId === existing.projectId &&
      nextProjectName === (existing.projectName ?? null)
    ) {
      return records;
    }

    const updatedRecord: GeneratedProjectRecord = {
      filename: existing.filename,
      projectId: nextProjectId ?? null,
      projectName: nextProjectName,
    };

    const nextRecords = [...records];
    nextRecords[existingIndex] = updatedRecord;
    return nextRecords;
  }

  return [
    ...records,
    {
      filename: canonicalFilename,
      projectId: normalizedProjectId ?? null,
      projectName: normalizedName,
    },
  ];
}

export function pruneGeneratedProjectRecords(
  records: GeneratedProjectRecord[],
  projects: SimpleProjectLike[],
): GeneratedProjectRecord[] {
  if (records.length === 0) {
    return records;
  }

  const activeIds = new Set<number>();
  const activeNames = new Set<string>();

  projects.forEach((project) => {
    if (typeof project.id === "number" && Number.isFinite(project.id)) {
      activeIds.add(project.id);
    }
    const normalizedName = normalizeProjectName(project.name ?? null);
    if (normalizedName) {
      activeNames.add(normalizedName.toLowerCase());
    }
  });

  let didChange = false;
  const filtered = records.filter((record) => {
    const canonicalFilename = normalizeFilename(record.filename);
    if (!canonicalFilename) {
      didChange = true;
      return false;
    }

    const hasId = typeof record.projectId === "number";
    if (hasId && !activeIds.has(record.projectId!)) {
      didChange = true;
      return false;
    }

    const normalizedName = normalizeProjectName(record.projectName ?? null);
    if (normalizedName && !activeNames.has(normalizedName.toLowerCase())) {
      didChange = true;
      return false;
    }

    return true;
  });

  return didChange ? filtered : records;
}

export function parseStoredGeneratedProjects(
  value: unknown,
): GeneratedProjectRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<GeneratedProjectRecord[]>((accumulator, entry) => {
    if (typeof entry === "string") {
      const canonical = normalizeFilename(entry);
      if (canonical) {
        return addOrUpdateGeneratedProjectRecord(accumulator, canonical, null, null);
      }
      return accumulator;
    }

    if (entry && typeof entry === "object") {
      const filenameCandidate = (entry as Record<string, unknown>).filename;
      if (typeof filenameCandidate !== "string") {
        return accumulator;
      }
      const canonicalFilename = normalizeFilename(filenameCandidate);
      if (!canonicalFilename) {
        return accumulator;
      }

      const projectIdCandidate = toNullableNumber(
        (entry as Record<string, unknown>).projectId,
      );
      const projectNameCandidate = normalizeProjectName(
        typeof (entry as Record<string, unknown>).projectName === "string"
          ? ((entry as Record<string, unknown>).projectName as string)
          : null,
      );

      return addOrUpdateGeneratedProjectRecord(
        accumulator,
        canonicalFilename,
        projectIdCandidate,
        projectNameCandidate ?? null,
      );
    }

    return accumulator;
  }, []);
}
