import { describe, expect, it, vi } from 'vitest';
import { invalidateAfterProfileChange, invalidateAfterProductChange } from './queryInvalidation.js';

describe('user-scoped query invalidation', () => {
  it('invalidates only the changed user and product space data', () => {
    const queryClient = { invalidateQueries: vi.fn() };

    invalidateAfterProductChange(queryClient, 'user-1', 'space-1', 'product-1');

    expect(queryClient.invalidateQueries.mock.calls.map(([query]) => query.queryKey)).toEqual([
      ['products', 'user-1', 'space-1'],
      ['space', 'user-1', 'space-1'],
      ['spaces', 'user-1'],
      ['dashboard', 'user-1'],
      ['space-preview-products', 'user-1', 'space-1'],
      ['product', 'user-1', 'product-1']
    ]);
  });

  it('invalidates user-scoped data when profile settings change', () => {
    const queryClient = { invalidateQueries: vi.fn() };

    invalidateAfterProfileChange(queryClient, 'user-1');

    expect(queryClient.invalidateQueries.mock.calls.map(([query]) => query.queryKey)).toEqual([
      ['dashboard', 'user-1'],
      ['spaces', 'user-1'],
      ['space', 'user-1'],
      ['products', 'user-1'],
      ['product', 'user-1'],
      ['space-preview-products', 'user-1'],
      ['members', 'user-1']
    ]);
  });
});
