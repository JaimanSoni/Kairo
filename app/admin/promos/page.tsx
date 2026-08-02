import { listPromos } from "@/lib/promos";
import { listPlans } from "@/lib/plans";
import { PageHead } from "@/components/admin/ui";
import { PromoEditor } from "@/components/admin/promo-editor";

export const metadata = { title: "Promo codes · Admin" };

export default async function PromosPage() {
  const [promos, plans] = await Promise.all([listPromos(), listPlans()]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHead title="Promo codes">
        Percent-off codes for checkout. The discount is computed and frozen server-side per order,
        a code is one use per account, and a code that has been used is retired rather than deleted.
      </PageHead>
      <PromoEditor
        initial={promos.map((p) => ({
          ...p,
          expiresAt: p.expiresAt ? p.expiresAt.toISOString().slice(0, 10) : null,
          createdAt: p.createdAt.toISOString(),
        }))}
        planKeys={plans.map((p) => ({ key: p.key, name: p.name }))}
      />
    </div>
  );
}
