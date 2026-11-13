import { api, apiResult, type Catalog, type Student } from "@/app/lib";
import { Dot } from "@/components/dort";
import { Page, ServiceDown } from "@/components/page-bits";
import { PageHeader } from "@/components/shell";
import { AISettings } from "./AISettings";
import { Privacy } from "./Privacy";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [cat, st, health] = await Promise.all([apiResult<Catalog>("catalog"), apiResult<Student>("student"),
    api<{ server_ai: boolean; server_ai_model?: string; server_ai_provider?: string }>("health")]);
  if (!cat.data || !st.data) return <ServiceDown error={cat.error ?? st.error} />;
  return (
    <Page>
      <PageHeader title="AI & privacy"
        lead="Bring your own AI: an API key from OpenAI, Anthropic, Gemini or OpenRouter, or a model running on your laptop. Everything also works without one." />
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="bg-inner-grad min-w-0 rounded-lg border p-4">
          <h2 className="mb-3 text-[14px] font-medium">Your AI connection</h2>
          <AISettings presets={cat.data.ai_presets} />
          {health?.server_ai && (
            <div className="bg-raised mt-4 flex items-start gap-2 rounded-md p-3 text-[12.5px]">
              <Dot tone="ok" className="mt-[6px]" />
              <p>
                This deployment has its own model: <span className="font-mono">{health.server_ai_model}</span> on {health.server_ai_provider}.
                It is used for everyone who has not connected a model of their own, so you can start without a key.
              </p>
            </div>
          )}
        </section>
        <section className="bg-inner-grad min-w-0 rounded-lg border p-4">
          <h2 className="mb-3 text-[14px] font-medium">Privacy</h2>
          <Privacy consent={!!st.data.consent_at} autoDelete={st.data.auto_delete} />
        </section>
      </div>
    </Page>
  );
}
