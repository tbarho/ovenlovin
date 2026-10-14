import { z } from "zod";

export type McpJsonSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: unknown;
};

/**
 * MCP tools/list needs a real JSON Schema. Zod 4's native converter works;
 * we strip `$schema` so clients get a plain object schema.
 */
export function zodToMcpInputSchema(schema: z.ZodType): McpJsonSchema {
  try {
    const raw = z.toJSONSchema(schema, { io: "input" }) as Record<string, unknown>;
    const { $schema: _ignored, ...rest } = raw;
    if (rest.type === "object" || rest.properties || rest.$ref) {
      return { type: "object", ...rest } as McpJsonSchema;
    }
  } catch {
    // Fall through to an empty object schema rather than advertise `{}`.
  }

  return { type: "object", properties: {}, additionalProperties: true };
}
