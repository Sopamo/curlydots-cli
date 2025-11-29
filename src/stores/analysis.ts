import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { AnalysisStatus, TaskId, TaskState } from '../types';

/**
 * Default task list with labels (initialized on reset)
 */
const DEFAULT_TASKS: TaskState[] = [
  { id: 'find_source_keys', label: 'Find source translation keys', status: 'pending' },
  { id: 'find_target_keys', label: 'Find target translation keys', status: 'pending' },
  { id: 'find_missing', label: 'Find missing translations', status: 'pending' },
  {
    id: 'find_code_context',
    label: 'Find code usage context',
    status: 'pending',
    progress: 0,
    processed: 0,
    total: 0,
  },
  {
    id: 'find_translation_context',
    label: 'Find existing translation context',
    status: 'pending',
    progress: 0,
    processed: 0,
    total: 0,
  },
  { id: 'export_csv', label: 'Export CSV file', status: 'pending' },
];

/**
 * Analysis store state
 */
export interface AnalysisState {
  /** Current analysis status */
  status: AnalysisStatus;

  /** Ordered list of checklist tasks with completion state */
  tasks: TaskState[];

  /** Currently active task ID */
  activeTaskId: TaskId | null;

  /** Number of keys found in source language */
  sourceKeyCount: number;

  /** Number of keys found in target language */
  targetKeyCount: number;

  /** Number of missing translations found */
  missingCount: number;

  /** Current key being processed (for progress display) */
  currentKey: string;

  /** Current progress (0-100) */
  progress: number;

  /** Error message if status is 'error' */
  error: string | null;

  /** Actions */
  setStatus: (status: AnalysisStatus) => void;
  startTask: (taskId: TaskId) => void;
  completeTask: (taskId: TaskId) => void;
  setTaskProgress: (taskId: TaskId, processed: number, total: number) => void;
  setProgress: (current: number, total: number) => void;
  setCounts: (source: number, target: number, missing: number) => void;
  setCurrentKey: (key: string) => void;
  setError: (message: string) => void;
  reset: () => void;
}

/**
 * Deep clone tasks array to avoid mutation
 */
function cloneTasks(tasks: TaskState[]): TaskState[] {
  return tasks.map((t) => ({ ...t }));
}

/**
 * Default analysis state
 */
const defaultState = {
  status: 'idle' as AnalysisStatus,
  tasks: cloneTasks(DEFAULT_TASKS),
  activeTaskId: null as TaskId | null,
  sourceKeyCount: 0,
  targetKeyCount: 0,
  missingCount: 0,
  currentKey: '',
  progress: 0,
  error: null,
};

/**
 * Vanilla Zustand store for analysis state (accessible outside React)
 */
export const analysisStore = createStore<AnalysisState>((set, get) => ({
  ...defaultState,

  setStatus: (status) => set({ status }),

  startTask: (taskId) => {
    const tasks = cloneTasks(get().tasks);
    for (const task of tasks) {
      if (task.id === taskId) {
        task.status = 'in_progress';
      } else if (task.status === 'in_progress') {
        // Only one task can be in_progress at a time
        task.status = 'pending';
      }
    }
    set({ tasks, activeTaskId: taskId });
  },

  completeTask: (taskId) => {
    const tasks = cloneTasks(get().tasks);
    for (const task of tasks) {
      if (task.id === taskId) {
        task.status = 'complete';
      }
    }
    const activeTaskId = get().activeTaskId === taskId ? null : get().activeTaskId;
    set({ tasks, activeTaskId });
  },

  setTaskProgress: (taskId, processed, total) => {
    const tasks = cloneTasks(get().tasks);
    for (const task of tasks) {
      if (task.id === taskId) {
        task.processed = processed;
        task.total = total;
        task.progress = total === 0 ? 0 : Math.min(Math.round((processed / total) * 100), 100);
      }
    }
    set({ tasks });
  },

  setProgress: (current, total) => {
    if (total === 0) {
      set({ progress: 0 });
      return;
    }
    const progress = Math.min(Math.round((current / total) * 100), 100);
    set({ progress });
  },

  setCounts: (sourceKeyCount, targetKeyCount, missingCount) =>
    set({ sourceKeyCount, targetKeyCount, missingCount }),

  setCurrentKey: (currentKey) => set({ currentKey }),

  setError: (message) => set({ error: message, status: 'error' }),

  reset: () => set({ ...defaultState, tasks: cloneTasks(DEFAULT_TASKS) }),
}));

/**
 * React hook for analysis store (use in UI components)
 * @example const progress = useAnalysisStore((s) => s.progress);
 */
export const useAnalysisStore = <T>(selector: (state: AnalysisState) => T): T =>
  useStore(analysisStore, selector);
