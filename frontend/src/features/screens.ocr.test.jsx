import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductForm } from './screens.jsx';

const { apiJson, createBillOcrTask } = vi.hoisted(() => ({
  apiJson: vi.fn(),
  createBillOcrTask: vi.fn()
}));

vi.mock('@/lib/api.js', async (importOriginal) => ({
  ...await importOriginal(),
  apiJson
}));

vi.mock('@/lib/auth.jsx', () => ({
  useAuth: () => ({ user: { currency: 'INR' } })
}));

vi.mock('@/lib/online.jsx', () => ({
  useOnlineStatus: () => true
}));

vi.mock('@/lib/ocr/recognize.js', () => ({ createBillOcrTask }));

describe('product form bill upload', () => {
  beforeEach(() => {
    apiJson.mockResolvedValue({ types: [], brands: [] });
    createBillOcrTask.mockClear();
  });

  it('clears unsupported input, reports a field error, and does not start OCR', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const router = createMemoryRouter([
      { path: '/', element: <ProductForm spaceId="space-1" onSaved={() => {}} /> }
    ]);
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    const input = screen.getByLabelText('Purchase bill file');
    fireEvent.change(input, {
      target: { files: [new File(['not an image'], 'bill.pdf', { type: 'application/pdf' })] }
    });

    expect((await screen.findByRole('alert')).textContent).toContain('Choose a JPEG, PNG, or WebP image.');
    expect(input.value).toBe('');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    await waitFor(() => expect(createBillOcrTask).not.toHaveBeenCalled());
    queryClient.clear();
  });

  it('uses free-text typeahead and an explicit custom warranty option without datalists', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const router = createMemoryRouter([
      { path: '/', element: <ProductForm spaceId="space-1" onSaved={() => {}} /> }
    ]);
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    const productType = await screen.findByRole('combobox', { name: 'Product type' });
    expect(container.querySelector('datalist')).toBeNull();
    expect(container.querySelector('form').noValidate).toBe(true);
    await act(async () => fireEvent.change(productType, { target: { value: 'dish' } }));
    await screen.findByRole('option', { name: 'Dishwasher' });
    await act(async () => fireEvent.keyDown(productType, { key: 'ArrowDown' }));
    await act(async () => fireEvent.keyDown(productType, { key: 'Enter' }));
    expect(productType.value).toBe('Dishwasher');

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Other' })));
    expect(screen.getByLabelText('Custom warranty in months')).toBeTruthy();
    queryClient.clear();
  });
});
