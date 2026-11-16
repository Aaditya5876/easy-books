import { describe, it, expect } from 'vitest';
import {
  normalizeStatus, normalizePriority, toTaskPayload, defaultMemoFolder, isTaskOverdue, TASK_STATUSES,
  toOrderItems, linesTotal, matchByName,
} from './tasks';

describe('job links helpers', () => {
  it('sends the linked client/employee ids, blanks as null', () => {
    expect(toTaskPayload({ title: 'x', party_id: '', assigned_employee_id: 'e1' })).toEqual({ title: 'x', partyId: null, assignedEmployeeId: 'e1' });
  });

  it('turns bill lines into API items, skipping empty ones', () => {
    const lines = [
      { description: ' Brake pad ', quantity: '2', unitPrice: '500', inventoryItemId: 'i1' },
      { description: '', quantity: 1, unitPrice: 9 },
      { description: 'Labour', quantity: 0, unitPrice: 9 },
      { description: 'Labour', quantity: 1, unitPrice: '' },
    ];
    expect(toOrderItems(lines)).toEqual([
      { inventoryItemId: 'i1', description: 'Brake pad', quantity: 2, unitPrice: 500 },
      { description: 'Labour', quantity: 1, unitPrice: 0 },
    ]);
    expect(linesTotal(lines)).toBe(1000);
    expect(linesTotal(lines, true)).toBe(1130);
  });

  it('matches existing records by name, ignoring case and spaces', () => {
    const rows = [{ id: 'a', name: 'Hari Stores' }];
    expect(matchByName(rows, ' hari stores ')).toEqual(rows[0]);
    expect(matchByName(rows, 'Hari')).toBeNull();
    expect(matchByName(rows, '')).toBeNull();
  });
});

describe('task format helpers', () => {
  it('maps every old spelling of status to the backend value', () => {
    expect(['pending', 'Pending', 'todo', 'PENDING'].map(normalizeStatus)).toEqual(Array(4).fill('PENDING'));
    expect(['in_progress', 'In Progress', 'in-progress', 'ongoing'].map(normalizeStatus)).toEqual(Array(4).fill('IN_PROGRESS'));
    expect(['Done', 'completed', 'complete', 'COMPLETED'].map(normalizeStatus)).toEqual(Array(4).fill('COMPLETED'));
    expect(normalizeStatus('cancelled')).toBe('CANCELLED');
    expect(normalizeStatus(undefined)).toBe('PENDING');
    expect(TASK_STATUSES).toEqual(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
  });

  it('maps priorities, keeping urgent', () => {
    expect(['low', 'Medium', 'HIGH', 'urgent'].map(normalizePriority)).toEqual(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
    expect(normalizePriority('')).toBe('MEDIUM');
  });

  it('builds the camelCase payload the API validates, blanks become null', () => {
    const payload = toTaskPayload({
      title: '  Fix bike ', status: 'Done', priority: 'high', workflow_type: 'JOB_CARD', due_date: '2026-12-01',
      due_time: '', party_type: '', party_name: 'Hari', assigned_name: 'Ram', assigned_to: 'ram@x.com',
      id: 'abc', created_at: 'x', taskNumber: 4, attachments: [],
    });
    expect(payload).toEqual({
      title: 'Fix bike', status: 'COMPLETED', priority: 'HIGH', workflowType: 'JOB_CARD', dueDate: '2026-12-01',
      dueTime: null, partyType: null, partyName: 'Hari', assignedName: 'Ram', assignedTo: 'ram@x.com',
    });
  });

  it('upper-cases the party type the Communication form keeps in lower case', () => {
    expect(toTaskPayload({ title: 'x', party_type: 'client' }).partyType).toBe('CLIENT');
  });

  it('keeps the date part of a full timestamp due date', () => {
    expect(toTaskPayload({ title: 'x', dueDate: '2026-12-01T00:00:00.000Z' }).dueDate).toBe('2026-12-01');
  });

  it('suggests a Memo folder from the task type', () => {
    expect(defaultMemoFolder('JOB_CARD')).toBe('job_card');
    expect(defaultMemoFolder('ORDER_SLIP')).toBe('order_slip');
    expect(defaultMemoFolder('APPOINTMENT')).toBe('supporting_doc');
  });

  it('overdue only while still open', () => {
    const past = '2020-01-01';
    expect(isTaskOverdue({ dueDate: past, status: 'PENDING' })).toBe(true);
    expect(isTaskOverdue({ dueDate: past, status: 'COMPLETED' })).toBe(false);
    expect(isTaskOverdue({ dueDate: null, status: 'PENDING' })).toBe(false);
  });
});
