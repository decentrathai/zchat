// Seed AI model pricing — run once after migration.
//
// Prices are Venice's published rates per 1M tokens (USD), accurate as of May 2026.
// Where Venice doesn't publish exact rates per model we use a conservative midpoint
// from the model's tier; safer to over-charge ourselves than under-charge the user.
//
// To re-seed: pnpm ts-node prisma/seed_ai_models.ts
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient();

type ModelEntry = {
  modelId: string;
  displayName: string;
  inputPer1mUsd: number;
  outputPer1mUsd: number;
  imagePerCallUsd?: number;
  isFreeTier: boolean;
  contextTokens?: number;
  privacy: 'private' | 'anonymized';
  supportsTools: boolean;
  supportsVision: boolean;
};

// Curated list — initial 12 most useful models. Add more later via admin tool.
const MODELS: ModelEntry[] = [
  // ── Free-tier cheap models (used during $0.20 trial) ───────────────────────
  {
    modelId: 'venice-uncensored-1-2',
    displayName: 'Venice Uncensored',
    inputPer1mUsd: 0.5,
    outputPer1mUsd: 1.5,
    isFreeTier: true,
    contextTokens: 128_000,
    privacy: 'private',
    supportsTools: false,
    supportsVision: true,
  },
  {
    modelId: 'qwen3-coder-480b-a35b-instruct-turbo',
    displayName: 'Qwen 3 Coder 480B (Turbo)',
    inputPer1mUsd: 1.2,
    outputPer1mUsd: 2.4,
    isFreeTier: true,
    contextTokens: 256_000,
    privacy: 'private',
    supportsTools: true,
    supportsVision: false,
  },
  {
    modelId: 'qwen3-235b-a22b-instruct-2507',
    displayName: 'Qwen 3 235B Instruct',
    inputPer1mUsd: 1.5,
    outputPer1mUsd: 3.0,
    isFreeTier: true,
    contextTokens: 128_000,
    privacy: 'private',
    supportsTools: true,
    supportsVision: false,
  },
  // ── Mid-tier paid ──────────────────────────────────────────────────────────
  {
    modelId: 'qwen3-vl-235b-a22b',
    displayName: 'Qwen 3 VL 235B (Vision)',
    inputPer1mUsd: 2.0,
    outputPer1mUsd: 4.0,
    isFreeTier: false,
    contextTokens: 256_000,
    privacy: 'private',
    supportsTools: true,
    supportsVision: true,
  },
  {
    modelId: 'deepseek-v3-2',
    displayName: 'DeepSeek V3.2',
    inputPer1mUsd: 2.5,
    outputPer1mUsd: 8.0,
    isFreeTier: false,
    contextTokens: 160_000,
    privacy: 'private',
    supportsTools: false,
    supportsVision: false,
  },
  // ── High-tier paid (proxied / anonymized) ──────────────────────────────────
  {
    modelId: 'claude-sonnet-4-6',
    displayName: 'Claude Sonnet 4.6',
    inputPer1mUsd: 3.0,
    outputPer1mUsd: 15.0,
    isFreeTier: false,
    contextTokens: 1_000_000,
    privacy: 'anonymized',
    supportsTools: true,
    supportsVision: true,
  },
  {
    modelId: 'claude-opus-4-6',
    displayName: 'Claude Opus 4.6',
    inputPer1mUsd: 15.0,
    outputPer1mUsd: 75.0,
    isFreeTier: false,
    contextTokens: 1_000_000,
    privacy: 'anonymized',
    supportsTools: true,
    supportsVision: true,
  },
  {
    modelId: 'openai-gpt-54',
    displayName: 'GPT-5.4',
    inputPer1mUsd: 4.0,
    outputPer1mUsd: 16.0,
    isFreeTier: false,
    contextTokens: 1_000_000,
    privacy: 'anonymized',
    supportsTools: true,
    supportsVision: true,
  },
  {
    modelId: 'gemini-3-1-pro-preview',
    displayName: 'Gemini 3.1 Pro',
    inputPer1mUsd: 2.5,
    outputPer1mUsd: 10.0,
    isFreeTier: false,
    contextTokens: 1_000_000,
    privacy: 'anonymized',
    supportsTools: true,
    supportsVision: true,
  },
  {
    modelId: 'grok-41-fast',
    displayName: 'Grok 4.1 Fast',
    inputPer1mUsd: 2.0,
    outputPer1mUsd: 8.0,
    isFreeTier: false,
    contextTokens: 1_000_000,
    privacy: 'anonymized',
    supportsTools: true,
    supportsVision: false,
  },
  // ── Image models — per-call pricing, token fields unused ───────────────────
  {
    modelId: 'flux-1-schnell',
    displayName: 'FLUX 1 Schnell',
    inputPer1mUsd: 0,
    outputPer1mUsd: 0,
    imagePerCallUsd: 0.04,
    isFreeTier: false,
    privacy: 'private',
    supportsTools: false,
    supportsVision: false,
  },
  {
    modelId: 'hidream-i1-dev',
    displayName: 'HiDream I1 (Dev)',
    inputPer1mUsd: 0,
    outputPer1mUsd: 0,
    imagePerCallUsd: 0.06,
    isFreeTier: false,
    privacy: 'private',
    supportsTools: false,
    supportsVision: false,
  },
];

async function main() {
  for (const m of MODELS) {
    await prisma.aiModelPricing.upsert({
      where: { modelId: m.modelId },
      update: {
        displayName: m.displayName,
        inputPer1mUsd: m.inputPer1mUsd,
        outputPer1mUsd: m.outputPer1mUsd,
        imagePerCallUsd: m.imagePerCallUsd ?? null,
        isFreeTier: m.isFreeTier,
        contextTokens: m.contextTokens ?? null,
        privacy: m.privacy,
        supportsTools: m.supportsTools,
        supportsVision: m.supportsVision,
      },
      create: {
        modelId: m.modelId,
        displayName: m.displayName,
        inputPer1mUsd: m.inputPer1mUsd,
        outputPer1mUsd: m.outputPer1mUsd,
        imagePerCallUsd: m.imagePerCallUsd ?? null,
        isFreeTier: m.isFreeTier,
        contextTokens: m.contextTokens ?? null,
        privacy: m.privacy,
        supportsTools: m.supportsTools,
        supportsVision: m.supportsVision,
      },
    });
  }
  console.log(`Seeded ${MODELS.length} model pricing rows`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
