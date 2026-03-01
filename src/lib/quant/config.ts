import type {
  ConfigAdjustment,
  QuantStrategyConfig,
  QuantStrategyId,
  RiskTolerancePreset,
} from "@/types";

export const LOOKBACK_MIN_YEARS = 3;
export const LOOKBACK_MAX_YEARS = 30;
export const TARGET_VOL_MIN = 0.06;
export const TARGET_VOL_MAX = 0.2;
export const GROSS_EXPOSURE_MIN = 0.3;
export const GROSS_EXPOSURE_MAX = 1.3;
export const NET_EXPOSURE_MIN = -0.3;
export const NET_EXPOSURE_MAX = 1.0;

export const RISK_TOLERANCE_TARGET_VOL: Record<RiskTolerancePreset, number> = {
  conservative: 0.08,
  balanced: 0.12,
  aggressive: 0.16,
};

export const DEFAULT_QUANT_CONFIG: QuantStrategyConfig = {
  lookbackMode: "fixed_years",
  lookbackYears: 15,
  positionMode: "long_only",
  riskTolerance: "balanced",
  targetVol: RISK_TOLERANCE_TARGET_VOL.balanced,
  grossExposureCap: 1,
  netExposureMin: 0,
  netExposureMax: 1,
};

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function pushAdjustment(
  adjustments: ConfigAdjustment[],
  field: ConfigAdjustment["field"],
  requested: number | string,
  applied: number | string,
  reason: string
) {
  if (requested === applied) return;
  adjustments.push({ field, requested, applied, reason });
}

function parseNumber(input: unknown, fallback: number): number {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input === "string") {
    const parsed = Number(input);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function getDefaultConfigForStrategy(
  strategyId: QuantStrategyId
): QuantStrategyConfig {
  if (strategyId === "quant-volatility-target-overlay") {
    return {
      ...DEFAULT_QUANT_CONFIG,
      riskTolerance: "conservative",
      targetVol: RISK_TOLERANCE_TARGET_VOL.conservative,
    };
  }
  return { ...DEFAULT_QUANT_CONFIG };
}

function supportsLongShort(strategyId: QuantStrategyId): boolean {
  return (
    strategyId === "quant-multifactor-stocks" ||
    strategyId === "quant-low-beta-quality"
  );
}

export function normalizeQuantConfig(
  strategyId: QuantStrategyId,
  input: Partial<QuantStrategyConfig> | undefined,
  options?: { expertMode?: boolean }
): {
  requestedConfig: QuantStrategyConfig;
  effectiveConfig: QuantStrategyConfig;
  adjustments: ConfigAdjustment[];
} {
  const expertMode = options?.expertMode ?? false;
  const baseConfig = getDefaultConfigForStrategy(strategyId);

  const requestedConfig: QuantStrategyConfig = {
    lookbackMode:
      input?.lookbackMode === "since_inception" ? "since_inception" : baseConfig.lookbackMode,
    lookbackYears: parseNumber(input?.lookbackYears, baseConfig.lookbackYears),
    positionMode:
      input?.positionMode === "long_short" ? "long_short" : baseConfig.positionMode,
    riskTolerance:
      input?.riskTolerance === "conservative" ||
      input?.riskTolerance === "balanced" ||
      input?.riskTolerance === "aggressive"
        ? input.riskTolerance
        : baseConfig.riskTolerance,
    targetVol: parseNumber(input?.targetVol, baseConfig.targetVol),
    grossExposureCap: parseNumber(input?.grossExposureCap, baseConfig.grossExposureCap),
    netExposureMin: parseNumber(input?.netExposureMin, baseConfig.netExposureMin),
    netExposureMax: parseNumber(input?.netExposureMax, baseConfig.netExposureMax),
  };

  const effectiveConfig: QuantStrategyConfig = { ...requestedConfig };
  const adjustments: ConfigAdjustment[] = [];

  const clampedLookback = Math.round(
    clampNumber(effectiveConfig.lookbackYears, LOOKBACK_MIN_YEARS, LOOKBACK_MAX_YEARS)
  );
  pushAdjustment(
    adjustments,
    "lookbackYears",
    effectiveConfig.lookbackYears,
    clampedLookback,
    `Lookback must be between ${LOOKBACK_MIN_YEARS} and ${LOOKBACK_MAX_YEARS} years.`
  );
  effectiveConfig.lookbackYears = clampedLookback;

  const presetVol = RISK_TOLERANCE_TARGET_VOL[effectiveConfig.riskTolerance];
  if (!expertMode) {
    pushAdjustment(
      adjustments,
      "targetVol",
      effectiveConfig.targetVol,
      presetVol,
      "Standard mode pins target volatility to the selected risk preset."
    );
    effectiveConfig.targetVol = presetVol;
  }

  const clampedTargetVol = clampNumber(
    effectiveConfig.targetVol,
    TARGET_VOL_MIN,
    TARGET_VOL_MAX
  );
  pushAdjustment(
    adjustments,
    "targetVol",
    effectiveConfig.targetVol,
    clampedTargetVol,
    `Target volatility must be between ${(TARGET_VOL_MIN * 100).toFixed(0)}% and ${(TARGET_VOL_MAX * 100).toFixed(0)}%.`
  );
  effectiveConfig.targetVol = clampedTargetVol;

  if (!expertMode || !supportsLongShort(strategyId)) {
    const requestedMode = effectiveConfig.positionMode;
    if (requestedMode !== "long_only") {
      pushAdjustment(
        adjustments,
        "positionMode",
        requestedMode,
        "long_only",
        "This strategy only supports long-only allocation."
      );
    }
    effectiveConfig.positionMode = "long_only";
  }

  const clampedGross = clampNumber(
    effectiveConfig.grossExposureCap,
    GROSS_EXPOSURE_MIN,
    GROSS_EXPOSURE_MAX
  );
  pushAdjustment(
    adjustments,
    "grossExposureCap",
    effectiveConfig.grossExposureCap,
    clampedGross,
    `Gross exposure cap must be between ${(GROSS_EXPOSURE_MIN * 100).toFixed(0)}% and ${(GROSS_EXPOSURE_MAX * 100).toFixed(0)}%.`
  );
  effectiveConfig.grossExposureCap = clampedGross;

  const clampedNetMin = clampNumber(
    effectiveConfig.netExposureMin,
    NET_EXPOSURE_MIN,
    NET_EXPOSURE_MAX
  );
  pushAdjustment(
    adjustments,
    "netExposureMin",
    effectiveConfig.netExposureMin,
    clampedNetMin,
    `Minimum net exposure must be between ${(NET_EXPOSURE_MIN * 100).toFixed(0)}% and ${(NET_EXPOSURE_MAX * 100).toFixed(0)}%.`
  );
  effectiveConfig.netExposureMin = clampedNetMin;

  const clampedNetMax = clampNumber(
    effectiveConfig.netExposureMax,
    NET_EXPOSURE_MIN,
    NET_EXPOSURE_MAX
  );
  pushAdjustment(
    adjustments,
    "netExposureMax",
    effectiveConfig.netExposureMax,
    clampedNetMax,
    `Maximum net exposure must be between ${(NET_EXPOSURE_MIN * 100).toFixed(0)}% and ${(NET_EXPOSURE_MAX * 100).toFixed(0)}%.`
  );
  effectiveConfig.netExposureMax = clampedNetMax;

  if (effectiveConfig.netExposureMax < effectiveConfig.netExposureMin) {
    pushAdjustment(
      adjustments,
      "netExposureMax",
      effectiveConfig.netExposureMax,
      effectiveConfig.netExposureMin,
      "Maximum net exposure cannot be lower than minimum net exposure."
    );
    effectiveConfig.netExposureMax = effectiveConfig.netExposureMin;
  }

  if (effectiveConfig.positionMode === "long_only") {
    if (effectiveConfig.netExposureMin < 0) {
      pushAdjustment(
        adjustments,
        "netExposureMin",
        effectiveConfig.netExposureMin,
        0,
        "Long-only mode cannot have negative net exposure."
      );
      effectiveConfig.netExposureMin = 0;
    }

    if (effectiveConfig.grossExposureCap > 1) {
      pushAdjustment(
        adjustments,
        "grossExposureCap",
        effectiveConfig.grossExposureCap,
        1,
        "Long-only mode caps gross exposure at 100%."
      );
      effectiveConfig.grossExposureCap = 1;
    }
  }

  return { requestedConfig, effectiveConfig, adjustments };
}
