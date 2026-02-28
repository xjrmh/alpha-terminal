"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { MODULES } from "@/lib/modules";
import { ModuleRunner } from "@/components/module-runner";

export default function ModulePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const mod = MODULES.find((m) => m.slug === slug);

  if (!mod) notFound();

  return <ModuleRunner moduleId={mod.id} />;
}
