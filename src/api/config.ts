const DEFAULT_API_BASE_URL = "http://localhost:8000";

const normalizeBaseUrl = (baseUrl: string): string => {
  const trimmed = baseUrl.trim();
  if (trimmed.endsWith("/")) {
    return trimmed.slice(0, -1);
  }
  return trimmed;
};

const resolveBaseUrl = (): string => {
  const envBaseUrl = import.meta.env?.VITE_API_BASE_URL as string | undefined;

  if (envBaseUrl && envBaseUrl.trim().length > 0) {
    return normalizeBaseUrl(envBaseUrl);
  }

  return DEFAULT_API_BASE_URL;
};

export const API_BASE_URL = resolveBaseUrl();
