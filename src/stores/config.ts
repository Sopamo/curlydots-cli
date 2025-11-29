import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { Config } from '../types';

/**
 * Default configuration values
 */
const defaultConfig: Config = {
  repoPath: '',
  translationsDir: '',
  sourceLanguage: '',
  targetLanguage: '',
  parser: 'node-module',
  extensions: ['.js', '.ts', '.jsx', '.tsx', '.vue', '.svelte', '.html'],
  outputPath: 'missing-translations.csv',
};

/**
 * Config store state with actions
 */
export interface ConfigState extends Config {
  /** Update configuration with partial values */
  setConfig: (config: Partial<Config>) => void;
  /** Reset configuration to defaults */
  reset: () => void;
}

/**
 * Vanilla Zustand store for config (accessible outside React)
 */
export const configStore = createStore<ConfigState>((set) => ({
  ...defaultConfig,

  setConfig: (config) => set((state) => ({ ...state, ...config })),

  reset: () => set(defaultConfig),
}));

/**
 * React hook for config store (use in UI components)
 * @example const repoPath = useConfigStore((s) => s.repoPath);
 */
export const useConfigStore = <T>(selector: (state: ConfigState) => T): T =>
  useStore(configStore, selector);
