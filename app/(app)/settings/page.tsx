import { apiResult, type Catalog, type Student } from "@/app/lib";
import { Page, ServiceDown } from "@/components/page-bits";
import { PageHeader } from "@/components/shell";
import { AISettings } from "./AISettings";
import { Privacy } from "./Privacy";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [cat, st] = await Promise.all([apiResult<Catalog>("catalog"), apiResult<Student>("student")]);
  if (!cat.data || !st.data) return <ServiceDown error={cat.error ?? st.error} />;
  return (
    <Page>
      <PageHeader title="AI & privacy"
        lead="Bring your own AI: an API key from OpenAI, Anthropic, Gemini or OpenRouter, or a model running on your laptop. Everything also works without one." />
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="min-w-0 rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-semibold">Your AI connection</h2>
          <AISettings presets={cat.data.ai_presets} />
          {cat.data.server_ai && (
            <p className="text-muted-foreground mt-3 text-xs">This deployment also has its own model, used when you have not connected one.</p>
          )}
        </section>
        <section className="min-w-0 rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-semibold">Privacy</h2>
          <Privacy consent={!!st.data.consent_at} autoDelete={st.data.auto_delete} />
        </section>
      </div>
    </Page>
  );
}
