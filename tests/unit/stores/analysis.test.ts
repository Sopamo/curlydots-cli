import { beforeEach, describe, expect, it } from 'bun:test';
import { analysisStore } from '../../../src/stores/analysis';

describe('analysisStore', () => {
  beforeEach(() => {
    // Reset store to defaults before each test
    analysisStore.getState().reset();
  });

  describe('initial state', () => {
    it('should have idle status', () => {
      expect(analysisStore.getState().status).toBe('idle');
    });

    it('should have zero sourceKeyCount', () => {
      expect(analysisStore.getState().sourceKeyCount).toBe(0);
    });

    it('should have zero targetKeyCount', () => {
      expect(analysisStore.getState().targetKeyCount).toBe(0);
    });

    it('should have zero missingCount', () => {
      expect(analysisStore.getState().missingCount).toBe(0);
    });

    it('should have empty currentKey', () => {
      expect(analysisStore.getState().currentKey).toBe('');
    });

    it('should have zero progress', () => {
      expect(analysisStore.getState().progress).toBe(0);
    });

    it('should have null error', () => {
      expect(analysisStore.getState().error).toBeNull();
    });
  });

  describe('setStatus', () => {
    it('should update status to parsing_source', () => {
      analysisStore.getState().setStatus('parsing_source');
      expect(analysisStore.getState().status).toBe('parsing_source');
    });

    it('should update status to complete', () => {
      analysisStore.getState().setStatus('complete');
      expect(analysisStore.getState().status).toBe('complete');
    });
  });

  describe('setProgress', () => {
    it('should calculate progress percentage', () => {
      analysisStore.getState().setProgress(5, 10);
      expect(analysisStore.getState().progress).toBe(50);
    });

    it('should handle zero total', () => {
      analysisStore.getState().setProgress(0, 0);
      expect(analysisStore.getState().progress).toBe(0);
    });

    it('should cap progress at 100', () => {
      analysisStore.getState().setProgress(15, 10);
      expect(analysisStore.getState().progress).toBe(100);
    });
  });

  describe('setError', () => {
    it('should set error message and status to error', () => {
      analysisStore.getState().setError('Something went wrong');

      const state = analysisStore.getState();
      expect(state.error).toBe('Something went wrong');
      expect(state.status).toBe('error');
    });
  });

  describe('setCounts', () => {
    it('should update source and target key counts', () => {
      analysisStore.getState().setCounts(100, 80, 20);

      const state = analysisStore.getState();
      expect(state.sourceKeyCount).toBe(100);
      expect(state.targetKeyCount).toBe(80);
      expect(state.missingCount).toBe(20);
    });
  });

  describe('setCurrentKey', () => {
    it('should update current key being processed', () => {
      analysisStore.getState().setCurrentKey('generic.welcome');
      expect(analysisStore.getState().currentKey).toBe('generic.welcome');
    });
  });

  describe('reset', () => {
    it('should reset all fields to defaults', () => {
      analysisStore.getState().setStatus('complete');
      analysisStore.getState().setCounts(100, 80, 20);
      analysisStore.getState().setProgress(10, 10);
      analysisStore.getState().setCurrentKey('test.key');

      analysisStore.getState().reset();

      const state = analysisStore.getState();
      expect(state.status).toBe('idle');
      expect(state.sourceKeyCount).toBe(0);
      expect(state.targetKeyCount).toBe(0);
      expect(state.missingCount).toBe(0);
      expect(state.progress).toBe(0);
      expect(state.currentKey).toBe('');
      expect(state.error).toBeNull();
    });

    it('should reset tasks to default pending state', () => {
      // Start a task
      analysisStore.getState().startTask('find_source_keys');

      analysisStore.getState().reset();

      const state = analysisStore.getState();
      expect(state.tasks.length).toBe(6);
      expect(state.tasks[0]?.status).toBe('pending');
      expect(state.activeTaskId).toBeNull();
    });
  });

  describe('tasks', () => {
    it('should have 6 tasks in initial state', () => {
      const state = analysisStore.getState();
      expect(state.tasks.length).toBe(6);
    });

    it('should have tasks in correct order', () => {
      const state = analysisStore.getState();
      expect(state.tasks[0]?.id).toBe('find_source_keys');
      expect(state.tasks[1]?.id).toBe('find_target_keys');
      expect(state.tasks[2]?.id).toBe('find_missing');
      expect(state.tasks[3]?.id).toBe('find_code_context');
      expect(state.tasks[4]?.id).toBe('find_translation_context');
      expect(state.tasks[5]?.id).toBe('export_csv');
    });

    it('should have correct labels for tasks', () => {
      const state = analysisStore.getState();
      expect(state.tasks[0]?.label).toBe('Find source translation keys');
      expect(state.tasks[3]?.label).toBe('Find code usage context');
      expect(state.tasks[5]?.label).toBe('Export CSV file');
    });

    it('should have all tasks pending initially', () => {
      const state = analysisStore.getState();
      for (const task of state.tasks) {
        expect(task.status).toBe('pending');
      }
    });

    it('should have null activeTaskId initially', () => {
      expect(analysisStore.getState().activeTaskId).toBeNull();
    });
  });

  describe('startTask', () => {
    it('should mark task as in_progress', () => {
      analysisStore.getState().startTask('find_source_keys');

      const task = analysisStore.getState().tasks.find((t) => t.id === 'find_source_keys');
      expect(task?.status).toBe('in_progress');
    });

    it('should set activeTaskId', () => {
      analysisStore.getState().startTask('find_target_keys');
      expect(analysisStore.getState().activeTaskId).toBe('find_target_keys');
    });

    it('should only have one task in_progress at a time', () => {
      analysisStore.getState().startTask('find_source_keys');
      analysisStore.getState().startTask('find_target_keys');

      const tasks = analysisStore.getState().tasks;
      const inProgressTasks = tasks.filter((t) => t.status === 'in_progress');
      expect(inProgressTasks.length).toBe(1);
      expect(inProgressTasks[0]?.id).toBe('find_target_keys');
    });
  });

  describe('completeTask', () => {
    it('should mark task as complete', () => {
      analysisStore.getState().startTask('find_source_keys');
      analysisStore.getState().completeTask('find_source_keys');

      const task = analysisStore.getState().tasks.find((t) => t.id === 'find_source_keys');
      expect(task?.status).toBe('complete');
    });

    it('should clear activeTaskId when completing active task', () => {
      analysisStore.getState().startTask('find_source_keys');
      analysisStore.getState().completeTask('find_source_keys');
      expect(analysisStore.getState().activeTaskId).toBeNull();
    });
  });

  describe('setTaskProgress', () => {
    it('should update progress for task', () => {
      analysisStore.getState().startTask('find_code_context');
      analysisStore.getState().setTaskProgress('find_code_context', 25, 50);

      const task = analysisStore.getState().tasks.find((t) => t.id === 'find_code_context');
      expect(task?.progress).toBe(50); // 25/50 = 50%
      expect(task?.processed).toBe(25);
      expect(task?.total).toBe(50);
    });

    it('should calculate percentage correctly', () => {
      analysisStore.getState().startTask('find_translation_context');
      analysisStore.getState().setTaskProgress('find_translation_context', 75, 100);

      const task = analysisStore.getState().tasks.find((t) => t.id === 'find_translation_context');
      expect(task?.progress).toBe(75);
    });

    it('should handle zero total', () => {
      analysisStore.getState().startTask('find_code_context');
      analysisStore.getState().setTaskProgress('find_code_context', 0, 0);

      const task = analysisStore.getState().tasks.find((t) => t.id === 'find_code_context');
      expect(task?.progress).toBe(0);
    });

    it('should cap progress at 100', () => {
      analysisStore.getState().startTask('find_code_context');
      analysisStore.getState().setTaskProgress('find_code_context', 150, 100);

      const task = analysisStore.getState().tasks.find((t) => t.id === 'find_code_context');
      expect(task?.progress).toBe(100);
    });
  });
});
