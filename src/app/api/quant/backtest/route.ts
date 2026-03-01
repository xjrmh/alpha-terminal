import { NextResponse } from "next/server";
import { isQuantModulesEnabledServer } from "@/lib/features";
import { runBacktest } from "@/lib/quant/engine";
import type { QuantBacktestRequest } from "@/types";

export const maxDuration = 120;

export async function POST(req: Request) {
  if (!isQuantModulesEnabledServer()) {
    return NextResponse.json(
      { error: "Quant modules are disabled." },
      { status: 404 }
    );
  }

  try {
    const payload = (await req.json()) as QuantBacktestRequest;
    const result = await runBacktest(payload);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
