import { afterEach, describe, expect, it, vi } from 'vitest';
import { focusFieldAfterRender, mapServerFieldErrors } from './formErrors.js';

afterEach(() => vi.useRealTimers());

describe('server form errors', () => {
  it('maps API field errors to React Hook Form setError calls', () => {
    const setError = vi.fn();
    expect(mapServerFieldErrors({ brand: 'Choose a brand.', purchasePrice: 'Invalid amount.' }, setError)).toEqual(['brand', 'purchasePrice']);
    expect(setError).toHaveBeenCalledWith('brand', { type: 'server', message: 'Choose a brand.' });
    expect(setError).toHaveBeenCalledTimes(2);
  });

  it('focuses the first server-invalid control after form state has rendered', () => {
    vi.useFakeTimers();
    const form = document.createElement('form');
    const field = document.createElement('input');
    field.name = 'brand';
    form.append(field);
    const focus = vi.spyOn(field, 'focus');

    focusFieldAfterRender('brand', form);
    vi.advanceTimersByTime(299);
    expect(focus).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(focus).toHaveBeenCalledOnce();
  });
});
