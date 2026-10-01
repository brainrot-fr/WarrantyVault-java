import { describe, expect, it } from 'vitest';
import { changePasswordSchema, productSchema, registrationSchema } from './formSchemas.js';

describe('form schemas', () => {
  it('validates account registration and reports normalized invalid fields', () => {
    const result = registrationSchema.safeParse({ name: 'A', email: 'bad', password: 'short' });
    expect(result.success).toBe(false);
    expect(result.error.issues.map(({ path }) => path[0])).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  it('requires matching account-registration password confirmation', () => {
    const result = registrationSchema.safeParse({
      name: 'Alex Doe', email: 'alex@example.com',
      password: 'long-enough-password', confirmPassword: 'different-password'
    });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toEqual(['confirmPassword']);
  });

  it('requires a matching password confirmation', () => {
    const result = changePasswordSchema.safeParse({ currentPassword: 'current-password', newPassword: 'new-password', confirmPassword: 'different-password' });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toEqual(['confirmPassword']);
  });

  it('rejects a password longer than 72 UTF-8 bytes', () => {
    const result = registrationSchema.safeParse({
      name: 'Alex Doe',
      email: 'alex@example.com',
      password: 'é'.repeat(37),
      confirmPassword: 'é'.repeat(37)
    });
    expect(result.success).toBe(false);
    expect(result.error.issues).toContainEqual(expect.objectContaining({
      path: ['password'],
      message: 'Use no more than 72 UTF-8 bytes.'
    }));
  });

  it('keeps product price precision and warranty bounds in shared validation', () => {
    const result = productSchema.safeParse({
      productType: 'Fridge', brand: 'Brand', purchasedOn: '2026-10-01',
      warrantyMonths: 121, purchasePrice: '12.345', currency: 'INR',
      modelName: '', serialNumber: '', notes: ''
    });
    expect(result.success).toBe(false);
    expect(result.error.issues.map(({ path }) => path[0])).toEqual(expect.arrayContaining(['warrantyMonths', 'purchasePrice']));
  });
});
