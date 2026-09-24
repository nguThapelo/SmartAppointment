import { z, type ZodTypeAny } from "zod";
import type { JsonSchema } from "../providers/types";

// Minimal zod → JSON Schema for tool parameters. Each tool's input is defined
// ONCE as a zod schema; the model sees this JSON Schema, and the executor
// validates the model's arguments against the same zod schema (strictly).
// Supports exactly the subset the tool catalog uses.

export function toJsonSchema(schema: ZodTypeAny): JsonSchema {
  const description = schema.description ? { description: schema.description } : {};
  const def = schema._def as { typeName: z.ZodFirstPartyTypeKind };

  switch (def.typeName) {
    case z.ZodFirstPartyTypeKind.ZodObject: {
      const shape = (schema as z.AnyZodObject).shape as Record<string, ZodTypeAny>;
      const properties: Record<string, JsonSchema> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = toJsonSchema(value);
        if (!value.isOptional()) required.push(key);
      }
      return { type: "object", properties, ...(required.length ? { required } : {}), ...description };
    }
    case z.ZodFirstPartyTypeKind.ZodString:
      return { type: "string", ...description };
    case z.ZodFirstPartyTypeKind.ZodNumber:
      return { type: (schema as z.ZodNumber).isInt ? "integer" : "number", ...description };
    case z.ZodFirstPartyTypeKind.ZodBoolean:
      return { type: "boolean", ...description };
    case z.ZodFirstPartyTypeKind.ZodEnum:
      return { type: "string", enum: (schema as z.ZodEnum<[string, ...string[]]>).options, ...description };
    case z.ZodFirstPartyTypeKind.ZodArray:
      return { type: "array", items: toJsonSchema((schema as z.ZodArray<ZodTypeAny>).element), ...description };
    case z.ZodFirstPartyTypeKind.ZodOptional:
    case z.ZodFirstPartyTypeKind.ZodNullable:
      return { ...toJsonSchema((schema as z.ZodOptional<ZodTypeAny>).unwrap()), ...description };
    case z.ZodFirstPartyTypeKind.ZodDefault:
      return { ...toJsonSchema((schema as z.ZodDefault<ZodTypeAny>).removeDefault()), ...description };
    case z.ZodFirstPartyTypeKind.ZodEffects:
      return { ...toJsonSchema((schema as z.ZodEffects<ZodTypeAny>).innerType()), ...description };
    default:
      throw new Error(`toJsonSchema: unsupported zod type ${def.typeName}`);
  }
}
