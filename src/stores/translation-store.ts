/**
 * Translation Store
 *
 * Zustand store for managing translation command state.
 */

import { create } from 'zustand';
import type { TranslateState, TranslateStatus, TranslationRow } from '../types';

interface TranslationStoreActions {
  /** Initialize store with rows and config */
  initialize: (
    rows: TranslationRow[],
    inputPath: string,
    outputPath: string,
    concurrency: number,
    force: boolean,
  ) => void;

  /** Set overall status */
  setStatus: (status: TranslateStatus) => void;

  /** Update a specific row */
  updateRow: (index: number, updates: Partial<TranslationRow>) => void;

  /** Mark row as processing */
  startRow: (index: number) => void;

  /** Mark row as complete with translation */
  completeRow: (index: number, translatedValue: string) => void;

  /** Mark row as error */
  errorRow: (index: number, errorMessage: string) => void;

  /** Mark row as skipped */
  skipRow: (index: number) => void;

  /** Increment consecutive error counter */
  incrementConsecutiveErrors: () => void;

  /** Reset consecutive error counter */
  resetConsecutiveErrors: () => void;

  /** Get rows that need translation */
  getRowsToTranslate: () => TranslationRow[];

  /** Reset store to initial state */
  reset: () => void;
}

const initialState: TranslateState = {
  rows: [],
  status: 'idle',
  totalToTranslate: 0,
  completedCount: 0,
  errorCount: 0,
  skippedCount: 0,
  consecutiveErrors: 0,
  inputPath: '',
  outputPath: '',
  concurrency: 5,
  force: false,
};

export const translationStore = create<TranslateState & TranslationStoreActions>((set, get) => ({
  ...initialState,

  initialize: (rows, inputPath, outputPath, concurrency, force) => {
    const toTranslate = rows.filter((r) => r.status === 'pending').length;
    const skipped = rows.filter((r) => r.status === 'skipped').length;

    set({
      rows,
      inputPath,
      outputPath,
      concurrency,
      force,
      totalToTranslate: toTranslate,
      skippedCount: skipped,
      status: 'idle',
      completedCount: 0,
      errorCount: 0,
      consecutiveErrors: 0,
    });
  },

  setStatus: (status) => set({ status }),

  updateRow: (index, updates) => {
    const rows = [...get().rows];
    const rowIndex = rows.findIndex((r) => r.index === index);
    if (rowIndex !== -1 && rows[rowIndex]) {
      rows[rowIndex] = { ...rows[rowIndex], ...updates };
      set({ rows });
    }
  },

  startRow: (index) => {
    get().updateRow(index, { status: 'processing' });
  },

  completeRow: (index, translatedValue) => {
    get().updateRow(index, {
      status: 'complete',
      translatedValue,
      errorMessage: undefined,
    });
    set((state) => ({
      completedCount: state.completedCount + 1,
    }));
    get().resetConsecutiveErrors();
  },

  errorRow: (index, errorMessage) => {
    get().updateRow(index, {
      status: 'error',
      translatedValue: 'ERROR',
      errorMessage,
    });
    set((state) => ({
      completedCount: state.completedCount + 1,
      errorCount: state.errorCount + 1,
    }));
    get().incrementConsecutiveErrors();
  },

  skipRow: (index) => {
    get().updateRow(index, { status: 'skipped' });
  },

  incrementConsecutiveErrors: () => {
    set((state) => ({
      consecutiveErrors: state.consecutiveErrors + 1,
    }));
  },

  resetConsecutiveErrors: () => {
    set({ consecutiveErrors: 0 });
  },

  getRowsToTranslate: () => {
    return get().rows.filter((r) => r.status === 'pending');
  },

  reset: () => set(initialState),
}));
