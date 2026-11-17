import { z } from 'zod';
import { PaymentMethodEnum } from './sales.schema';

export const SpaceRateUnitEnum = z.enum(['NIGHT', 'DAY', 'HOUR', 'VISIT']);

const spaceFields = {
  name: z.string().trim().min(1).max(40),
  // What the business calls it: Room, Table, Bed, Chair…
  type: z.string().trim().min(1).max(30),
  capacity: z.number().int().min(0).max(1000).optional().nullable(),
  rate: z.number().nonnegative().optional().nullable(),
  rateUnit: SpaceRateUnitEnum.optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  sortOrder: z.number().int().optional(),
};

export const CreateSpaceSchema = z.object(spaceFields).passthrough();
export const UpdateSpaceSchema = z.object(spaceFields).partial().passthrough();
export const BulkSpacesSchema = z.object({
  type: spaceFields.type,
  names: z.array(z.string().trim().min(1).max(40)).min(1).max(200),
  capacity: spaceFields.capacity,
  rate: spaceFields.rate,
  rateUnit: spaceFields.rateUnit,
}).passthrough();

// Only these can be set by hand; OCCUPIED / RESERVED come from sessions.
export const SetSpaceStatusSchema = z.object({ status: z.enum(['FREE', 'CLEANING', 'OUT_OF_SERVICE']) }).passthrough();

export const StartSpaceSessionSchema = z.object({
  mode: z.enum(['OCCUPY', 'RESERVE']),
  guestName: z.string().trim().min(1).max(120),
  guestContact: z.string().trim().max(60).optional().nullable(),
  guests: z.number().int().min(0).max(1000).optional().nullable(),
  reservedFor: z.string().optional().nullable(),
  expectedEnd: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
}).passthrough();

export const AddSpaceChargeSchema = z.object({
  inventoryItemId: z.string().uuid().optional().nullable(),
  description: z.string().trim().min(1).max(200).optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative().optional(),
}).passthrough().refine((v) => v.inventoryItemId || (v.description && v.unitPrice !== undefined), {
  message: 'Give a stock item, or a description and price',
});

export const CloseSpaceSessionSchema = z.object({
  paymentMethod: PaymentMethodEnum.optional(),
  isVat: z.boolean().optional(),
  includeTimeCharge: z.boolean().optional(),
  // Override the computed nights/hours (e.g. late checkout waived).
  timeQuantity: z.number().min(0).optional(),
  nextStatus: z.enum(['FREE', 'CLEANING']).optional(),
}).passthrough();
