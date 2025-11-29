import { describe, expect, it } from 'bun:test';
import type { TaskId, TaskState } from '../../../src/types';

describe('TaskId type', () => {
  it('should allow valid task IDs', () => {
    const validIds: TaskId[] = [
      'find_source_keys',
      'find_target_keys',
      'find_missing',
      'find_code_context',
      'find_translation_context',
      'export_csv',
    ];

    expect(validIds.length).toBe(6);
  });

  it('should have all required task IDs in correct order', () => {
    const taskOrder: TaskId[] = [
      'find_source_keys',
      'find_target_keys',
      'find_missing',
      'find_code_context',
      'find_translation_context',
      'export_csv',
    ];

    // Verify the expected IDs exist
    expect(taskOrder[0]).toBe('find_source_keys');
    expect(taskOrder[1]).toBe('find_target_keys');
    expect(taskOrder[2]).toBe('find_missing');
    expect(taskOrder[3]).toBe('find_code_context');
    expect(taskOrder[4]).toBe('find_translation_context');
    expect(taskOrder[5]).toBe('export_csv');
  });
});

describe('TaskState interface', () => {
  it('should have required fields', () => {
    const task: TaskState = {
      id: 'find_source_keys',
      label: 'Find source translation keys',
      status: 'pending',
    };

    expect(task.id).toBe('find_source_keys');
    expect(task.label).toBe('Find source translation keys');
    expect(task.status).toBe('pending');
  });

  it('should allow pending status', () => {
    const task: TaskState = {
      id: 'find_source_keys',
      label: 'Test',
      status: 'pending',
    };
    expect(task.status).toBe('pending');
  });

  it('should allow in_progress status', () => {
    const task: TaskState = {
      id: 'find_source_keys',
      label: 'Test',
      status: 'in_progress',
    };
    expect(task.status).toBe('in_progress');
  });

  it('should allow complete status', () => {
    const task: TaskState = {
      id: 'find_source_keys',
      label: 'Test',
      status: 'complete',
    };
    expect(task.status).toBe('complete');
  });

  it('should support optional progress field', () => {
    const task: TaskState = {
      id: 'find_code_context',
      label: 'Find code usage context',
      status: 'in_progress',
      progress: 50,
    };

    expect(task.progress).toBe(50);
  });

  it('should support optional processed field', () => {
    const task: TaskState = {
      id: 'find_code_context',
      label: 'Find code usage context',
      status: 'in_progress',
      processed: 25,
      total: 50,
    };

    expect(task.processed).toBe(25);
    expect(task.total).toBe(50);
  });
});
