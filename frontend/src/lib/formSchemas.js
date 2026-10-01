import { z } from 'zod';
import { isValidPrice } from './formValidation.js';
import { localDateInputValue } from './formatters.js';

const emailSchema = z.string().trim().email('Enter a valid email address.');
const passwordSchema = z.string()
  .min(8, 'Use at least 8 characters.')
  .max(72, 'Use no more than 72 characters.')
  .refine((value) => new globalThis.TextEncoder().encode(value).length <= 72, 'Use no more than 72 UTF-8 bytes.');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.')
});

export const registrationSchema = loginSchema.extend({
  name: z.string().trim().min(2, 'Enter at least 2 characters.').max(120, 'Use no more than 120 characters.')
}).extend({
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Confirm your password.')
}).refine((values) => values.password === values.confirmPassword, {
  path: ['confirmPassword'],
  message: 'Passwords do not match.'
});

export const spaceSchema = z.object({
  name: z.string().trim().min(1, 'Enter a Space name.').max(80, 'Use no more than 80 characters.'),
  description: z.string().max(255, 'Use no more than 255 characters.')
});

export const inviteSchema = z.object({
  email: emailSchema,
  role: z.enum(['VIEWER', 'EDITOR'])
});

export const profileSchema = z.object({
  name: z.string().trim().min(2, 'Enter at least 2 characters.').max(120, 'Use no more than 120 characters.'),
  timezone: z.string().min(1, 'Choose a timezone.'),
  currency: z.string().regex(/^[A-Z]{3}$/, 'Choose a currency.')
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: passwordSchema,
  confirmPassword: z.string().min(1, 'Confirm your new password.')
}).refine((values) => values.newPassword === values.confirmPassword, {
  path: ['confirmPassword'],
  message: 'Passwords do not match.'
});

export const productSchema = z.object({
  productType: z.string().trim().min(1, 'Enter a product type.').max(60, 'Use no more than 60 characters.'),
  brand: z.string().trim().min(1, 'Enter a brand.').max(60, 'Use no more than 60 characters.'),
  purchasedOn: z.string().min(1, 'Choose the purchase date.').refine((value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Enter a valid purchase date.').refine((value) => value <= localDateInputValue(), 'Purchase date cannot be in the future.'),
  warrantyMonths: z.coerce.number().int('Enter a whole number of months.').min(1, 'Warranty must be at least 1 month.').max(120, 'Warranty cannot exceed 120 months.'),
  purchasePrice: z.string().refine(isValidPrice, 'Enter an amount with up to two decimal places.'),
  currency: z.string().regex(/^[A-Z]{3}$/, 'Choose a currency.'),
  modelName: z.string().max(120, 'Use no more than 120 characters.'),
  serialNumber: z.string().max(120, 'Use no more than 120 characters.'),
  notes: z.string().max(1000, 'Use no more than 1000 characters.')
});
