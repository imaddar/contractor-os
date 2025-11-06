import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ProgressStatus = "pending" | "in-progress" | "completed" | "error";

export interface ProgressStepState {
  id: string;
  label: string;
  status: ProgressStatus;
}

export interface ThinkingLine {
  id: string;
  text: string;
}

interface GenerationStatusState {
  isVisible: boolean;
  isComplete: boolean;
  isMinimized: boolean;
  steps: ProgressStepState[];
  thinkingFeed: ThinkingLine[];
  error: string | null;
  success: string | null;
}

type SetStateAction<T> = T | ((previous: T) => T);

interface GenerationStatusContextValue {
  state: GenerationStatusState;
  openPanel: () => void;
  dismissPanel: () => void;
  setComplete: (value: boolean) => void;
  setMinimized: (value: boolean) => void;
  toggleMinimized: () => void;
  setSteps: (updater: SetStateAction<ProgressStepState[]>) => void;
  updateStep: (stepId: string, status: ProgressStatus) => void;
  setThinkingFeed: (updater: SetStateAction<ThinkingLine[]>) => void;
  setError: (value: string | null) => void;
  setSuccess: (value: string | null) => void;
}

const initialState: GenerationStatusState = {
  isVisible: false,
  isComplete: false,
  isMinimized: false,
  steps: [],
  thinkingFeed: [],
  error: null,
  success: null,
};

const GenerationStatusContext = createContext<GenerationStatusContextValue | null>(
  null,
);

export function GenerationStatusProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState<GenerationStatusState>(initialState);

  const openPanel = useCallback(() => {
    setState((previous) => ({
      ...previous,
      isVisible: true,
      isMinimized: false,
    }));
  }, []);

  const dismissPanel = useCallback(() => {
    setState(initialState);
  }, []);

  const setComplete = useCallback((value: boolean) => {
    setState((previous) => ({
      ...previous,
      isComplete: value,
      isMinimized: value ? false : previous.isMinimized,
    }));
  }, []);

  const setMinimized = useCallback((value: boolean) => {
    setState((previous) => {
      if (!previous.isVisible) {
        return previous;
      }
      if (previous.isComplete) {
        return {
          ...previous,
          isMinimized: false,
        };
      }
      return {
        ...previous,
        isMinimized: value,
      };
    });
  }, []);

  const toggleMinimized = useCallback(() => {
    setState((previous) => {
      if (!previous.isVisible) {
        return previous;
      }
      if (previous.isComplete) {
        return {
          ...previous,
          isMinimized: false,
        };
      }
      return {
        ...previous,
        isMinimized: !previous.isMinimized,
      };
    });
  }, []);

  const setSteps = useCallback(
    (updater: SetStateAction<ProgressStepState[]>) => {
      setState((previous) => ({
        ...previous,
        steps:
          typeof updater === "function"
            ? (updater as (value: ProgressStepState[]) => ProgressStepState[])(
                previous.steps,
              )
            : updater,
      }));
    },
    [],
  );

  const updateStep = useCallback(
    (stepId: string, status: ProgressStatus) => {
      setState((previous) => ({
        ...previous,
        steps: previous.steps.map((step) =>
          step.id === stepId ? { ...step, status } : step,
        ),
      }));
    },
    [],
  );

  const setThinkingFeed = useCallback(
    (updater: SetStateAction<ThinkingLine[]>) => {
      setState((previous) => ({
        ...previous,
        thinkingFeed:
          typeof updater === "function"
            ? (updater as (value: ThinkingLine[]) => ThinkingLine[])(
                previous.thinkingFeed,
              )
            : updater,
      }));
    },
    [],
  );

  const setError = useCallback((value: string | null) => {
    setState((previous) => ({
      ...previous,
      error: value,
    }));
  }, []);

  const setSuccess = useCallback((value: string | null) => {
    setState((previous) => ({
      ...previous,
      success: value,
    }));
  }, []);

  const contextValue = useMemo<GenerationStatusContextValue>(
    () => ({
      state,
      openPanel,
      dismissPanel,
      setComplete,
      setMinimized,
      toggleMinimized,
      setSteps,
      updateStep,
      setThinkingFeed,
      setError,
      setSuccess,
    }),
    [
      state,
      openPanel,
      dismissPanel,
      setComplete,
      setMinimized,
      toggleMinimized,
      setSteps,
      updateStep,
      setThinkingFeed,
      setError,
      setSuccess,
    ],
  );

  return (
    <GenerationStatusContext.Provider value={contextValue}>
      {children}
    </GenerationStatusContext.Provider>
  );
}
// eslint-disable-next-line react-refresh/only-export-components
export function useGenerationStatus() {
  const context = useContext(GenerationStatusContext);
  if (!context) {
    throw new Error(
      "useGenerationStatus must be used within a GenerationStatusProvider",
    );
  }
  return context;
}
