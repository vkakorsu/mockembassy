import { env, features } from "@/lib/env";
import { availableModels } from "@/lib/server/gemini";

/**
 * Public, read-only: whether each service is configured and whether the
 * configured Gemini model ids exist for this key. Makes no generation calls
 * (listing models is free) and caches the answer, so it can't run up cost.
 */
let cached: { at: number; body: unknown } | undefined;
const TTL_MS = 10 * 60_000;

export async function GET() {
  if (cached && Date.now() - cached.at < TTL_MS) return Response.json(cached.body);

  let gemini: Record<string, unknown> = { configured: features.gemini };
  if (features.gemini) {
    try {
      const { liveModels, flashModels } = await availableModels();
      gemini = {
        configured: true,
        live: { id: env.geminiLiveModel, available: liveModels.includes(env.geminiLiveModel) },
        flash: { id: env.geminiFlashModel, available: flashModels.includes(env.geminiFlashModel) },
        liveModels,
        flashModels,
      };
    } catch (e) {
      gemini = { configured: true, error: e instanceof Error ? e.message.slice(0, 200) : "failed" };
    }
  }
  const body = {
    checkedAt: new Date().toISOString(),
    supabaseAdmin: features.supabaseAdmin,
    paystack: features.paystack,
    gemini,
  };
  cached = { at: Date.now(), body };
  return Response.json(body);
}
