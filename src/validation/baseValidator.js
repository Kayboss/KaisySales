import { z } from 'zod';

/**
 * Base Validator Schemas
 * Standard schemas for common data structures with built-in sanitization.
 */

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').trim().lowercase(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const inventoryItemSchema = z.object({
  sku: z.string().min(5, 'SKU must be at least 5 characters').regex(/^[a-zA-Z0-9-]+$/, 'Invalid characters in SKU'),
  name: z.string().min(2, 'Name is too short').max(100, 'Name is too long').trim(),
  quantity: z.number().int().nonnegative('Quantity cannot be negative'),
  price: z.number().positive('Price must be greater than 0'),
});

/**
 * Helper function to sanitize user input strings
 * Removes potentially dangerous HTML/script tags
 */
export const sanitizeInput = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/[<>]/g, ''); // Simple sanitization, consider DOMPurify for complex needs
};
