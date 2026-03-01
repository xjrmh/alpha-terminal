import { NextResponse } from "next/server";
import { isQuantModulesEnabledServer } from "@/lib/features";
import { getQuantUniverse } from "@/lib/quant/engine";

export async function GET() {
  if (!isQuantModulesEnabledServer()) {
    return NextResponse.json(
      { error: "Quant modules are disabled." },
      { status: 404 }
    );
  }

  return NextResponse.json(getQuantUniverse());
}
