import Link from "next/link";
import PublicHeader from "../components/PublicHeader";

const plans = [
  {
    name: "Department Lab",
    price: "Included",
    description:
      "For NITK department lab examinations and internal practical assessments.",
    features: [
      "Faculty exam authoring",
      "Student lockdown flow",
      "Online compiler",
      "Result export",
    ],
  },
  {
    name: "Institution",
    price: "Contact admin",
    description:
      "For multi-department rollout with approval workflows and central oversight.",
    features: [
      "Admin provisioning",
      "Batch eligibility",
      "Live session monitoring",
      "Audit-friendly records",
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background-light font-display text-slate-900 dark:bg-background-dark dark:text-slate-100">
      <PublicHeader />
      <main className="px-6 py-16 md:px-20 md:py-24">
        <div className="mx-auto flex max-w-275 flex-col gap-12">
          <section className="max-w-3xl">
            <span className="text-xs font-bold uppercase tracking-widest text-secondary">
              Pricing
            </span>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-primary md:text-6xl">
              Built for campus lab exams.
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-slate-600 dark:text-slate-400">
              LabLock is an internal examination platform. Use the department
              plan for routine labs, or coordinate an institution rollout when
              multiple departments need the same workflow.
            </p>
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className="rounded-3xl border border-primary/10 bg-white p-8 shadow-sm dark:bg-slate-800"
              >
                <h2 className="text-2xl font-black text-primary">
                  {plan.name}
                </h2>
                <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">
                  {plan.price}
                </p>
                <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {plan.description}
                </p>
                <ul className="mt-6 space-y-3 text-sm text-slate-700 dark:text-slate-200">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <span className="material-symbols-outlined text-base text-secondary">
                        check_circle
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </section>

          <section className="rounded-3xl bg-primary p-8 text-white md:p-10">
            <h2 className="text-2xl font-black">Ready to start?</h2>
            <p className="mt-3 max-w-2xl text-accent">
              Sign in with your assigned role or create an account for the next
              approved lab exam workflow.
            </p>
            <Link
              href="/auth"
              className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-white px-6 text-sm font-bold text-primary transition-all hover:bg-background-light"
            >
              Continue to LabLock
            </Link>
          </section>
        </div>
      </main>
    </div>
  );
}
