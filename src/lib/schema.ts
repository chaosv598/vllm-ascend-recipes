import { z } from 'zod';

export const weightSourceSchema = z.object({
  source: z.string(),
  url: z.string(),
  command: z.string(),
});

export const weightDownloadSchema = z.object({
  weight_version: z.string(),
  sources: z.array(weightSourceSchema),
});

export const prerequisiteItemSchema = z.object({
  title: z.string(),
  content: z.string(),
});

export const envSetupItemSchema = z.object({
  content: z.string(),
});

export const envSetupSchema = z
  .object({
    pip: envSetupItemSchema.optional(),
    container: envSetupItemSchema.optional(),
  })
  .refine((data) => data.pip || data.container, {
    message: 'env_setup must have at least one of pip or container',
  });

export const quantizationSchema = z.object({
  content: z.string(),
});

export const scenarioStepSchema = z.object({
  title: z.string(),
  content: z.string(),
});

export const scenarioSchema = z.object({
  npu: z.string(),
  precision: z.string(),
  deployment: z.string(),
  verified: z.boolean(),
  steps: z.array(scenarioStepSchema),
});

export const performanceTableSchema = z.object({
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});

export const referenceSchema = z.object({
  title: z.string(),
  url: z.string(),
});

export const modelSchema = z.object({
  hf_id: z.string(),
  title: z.string(),
  provider: z.string(),
  description: z.string(),
  architecture: z.enum(['dense', 'moe']),
  parameters: z.string(),
  active_parameters: z.string().nullable(),
  context_length: z.number(),
  modality: z.string(),
  updated: z.string(),
  overview: z.string(),
  weight_download: z.array(weightDownloadSchema),
  quantization: quantizationSchema.optional(),
  prerequisites: z.array(prerequisiteItemSchema).optional(),
  env_setup: envSetupSchema,
  scenarios: z.array(scenarioSchema),
  performance_accuracy: performanceTableSchema.optional(),
  performance_benchmark: performanceTableSchema.optional(),
  references: z.array(referenceSchema),
});

export type ModelSchema = z.infer<typeof modelSchema>;
