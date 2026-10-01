import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Field, FormStack, FreeTextCombobox, ImagePicker, SwitchControl } from './Primitives.jsx';

describe('Field', () => {
  it('connects the label, hint, and validation error to its input', () => {
    render(<Field error="Enter a valid amount." hint="Use up to two decimal places." label="Purchase price" name="purchasePrice" />);
    const input = screen.getByLabelText('Purchase price');
    const error = screen.getByRole('alert');

    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toContain('field-');
    expect(input.getAttribute('aria-describedby')).toContain(error.id);
  });

  describe('form controls', () => {
    it('makes FormStack disable browser validation in favor of the shared schema', () => {
      render(<FormStack aria-label="Account form"><input required /></FormStack>);
      expect(screen.getByRole('form', { name: 'Account form' }).noValidate).toBe(true);
    });

    it('supports free text and keyboard selection from merged suggestions', () => {
      function Harness() {
        const [value, setValue] = useState('');
        return <FreeTextCombobox label="Product type" name="productType" onChange={(event) => setValue(event.target.value)} options={['Refrigerator', 'Television']} value={value} />;
      }

      render(<Harness />);
      const input = screen.getByRole('combobox', { name: 'Product type' });
      fireEvent.change(input, { target: { value: 'TV' } });
      expect(input.value).toBe('TV');
      fireEvent.change(input, { target: { value: 'tele' } });
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(input.value).toBe('Television');
      fireEvent.change(input, { target: { value: 'A brand not listed' } });
      expect(input.value).toBe('A brand not listed');
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(screen.getByRole('option', { name: 'Use "A brand not listed"' })).toBeTruthy();
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(input.value).toBe('A brand not listed');
    });

    it('shows selected image name and size and exposes replace and remove actions', () => {
      function Harness() {
        const [file, setFile] = useState(null);
        return <ImagePicker file={file} label="Purchase bill" onRemove={() => setFile(null)} onSelect={setFile} />;
      }

      render(<Harness />);
      const file = new File(['image bytes'], 'bill.png', { type: 'image/png' });
      const fileInput = screen.getByLabelText('Purchase bill file');
      expect(fileInput.accept).toContain('image/webp');
      fireEvent.change(fileInput, { target: { files: [file] } });
      expect(screen.getByText('bill.png')).toBeTruthy();
      expect(screen.getByText('1 KB')).toBeTruthy();
      expect(screen.getByLabelText('Purchase bill camera').getAttribute('capture')).toBe('environment');
      expect(screen.getByRole('button', { name: 'Replace' })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
      expect(screen.getByRole('button', { name: 'Choose a photo' })).toBeTruthy();
    });

    it('exposes switch state to assistive technology and supports toggling', () => {
      const onChange = vi.fn();
      render(<SwitchControl checked={false} label="Warranty reminders" onChange={onChange} />);
      const toggle = screen.getByRole('switch', { name: 'Warranty reminders' });
      expect(toggle.checked).toBe(false);
      fireEvent.click(toggle);
      expect(onChange).toHaveBeenCalledOnce();
    });
  });

  it('keeps native input behavior and label association for a valid field', () => {
    render(<Field label="Email address" name="email" required type="email" />);
    const input = screen.getByLabelText('Email address');

    expect(input.getAttribute('type')).toBe('email');
    expect(input.required).toBe(true);
    expect(input.getAttribute('aria-invalid')).not.toBe('true');
    fireEvent.change(input, { target: { value: 'person@example.com' } });
    expect(input.value).toBe('person@example.com');
  });
});
