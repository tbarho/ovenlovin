import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const timestampSchema = z.string().datetime();

export const idSchema = z.object({
  id: uuidSchema,
});

export const timestampsSchema = z.object({
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  deletedAt: timestampSchema.nullable().optional(),
});

export const createdBySchema = z.object({
  createdBy: uuidSchema,
});

export const baseEntitySchema = idSchema.merge(timestampsSchema);

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  cursor: z.string().optional(),
});

export const paginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  });

export type Pagination = z.infer<typeof paginationQuerySchema>;
export type PaginatedResponse<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};
