export function isQuantModulesEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_QUANT_MODULES !== "false";
}

export function isExpertModeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_EXPERT_MODE !== "false";
}

export function isQuantModulesEnabledServer(): boolean {
  const publicFlag = process.env.NEXT_PUBLIC_ENABLE_QUANT_MODULES;
  const serverFlag = process.env.ENABLE_QUANT_MODULES;

  if (serverFlag === "false") return false;
  if (serverFlag === "true") return true;

  return publicFlag !== "false";
}
