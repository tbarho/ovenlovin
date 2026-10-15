export type PlanBlockNight = {
  weekday: string;
  message: string;
};

export function planFinalConfirmCopy(opts: {
  needsRecheck: boolean;
  blockNights: PlanBlockNight[];
}): { needsConfirm: boolean; title: string; body: string } {
  const blocks = opts.blockNights;
  if (!opts.needsRecheck && blocks.length === 0) {
    return { needsConfirm: false, title: "", body: "" };
  }

  const title = "Mark this plan as final?";
  if (opts.needsRecheck && blocks.length > 0) {
    const first = blocks[0];
    const night = first?.weekday ?? "This dinner";
    return {
      needsConfirm: true,
      title,
      body: `This plan still needs a recheck, and ${night} has an anaphylaxis-risk dinner. Mark it final anyway? Warnings stay on the plan.`,
    };
  }
  if (opts.needsRecheck) {
    return {
      needsConfirm: true,
      title,
      body: "This plan still needs a recheck. A recipe or someone's rules changed. Mark it final anyway?",
    };
  }
  const nightList = blocks.map((night) => night.weekday).join(", ");
  const verb = blocks.length === 1 ? "has" : "have";
  return {
    needsConfirm: true,
    title,
    body: `${nightList} ${verb} an anaphylaxis-risk dinner. Mark it final anyway? Warnings stay on the plan.`,
  };
}

export function recheckBannerDetail(opts: {
  nights: string[];
  blockNights?: PlanBlockNight[];
}): string {
  const nights = opts.nights;
  const blocks = opts.blockNights ?? [];
  const nightBit =
    nights.length > 0
      ? `These dinners need a fresh check: ${nights.join(", ")}.`
      : "A recipe or someone's rules changed since the last check.";
  const firstBlock = blocks[0];
  if (!firstBlock) return nightBit;
  return `${nightBit} ${firstBlock.weekday} still has a can't-eat dinner.`;
}

export function blockNightsFromDays(
  days: Array<{
    weekday: string;
    meals: Array<{ findings: Array<{ severity: string; message: string }> }>;
  }>
): PlanBlockNight[] {
  const nights: PlanBlockNight[] = [];
  for (const day of days) {
    for (const meal of day.meals) {
      const blocked = meal.findings.find((finding) => finding.severity === "block");
      if (blocked) {
        nights.push({ weekday: day.weekday, message: blocked.message });
        break;
      }
    }
  }
  return nights;
}

export function recheckNightsFromDays(
  days: Array<{
    weekday: string;
    meals: Array<{ isNoCook: boolean; recipeId?: string | null }>;
  }>
): string[] {
  return days
    .filter((day) => day.meals.some((meal) => !meal.isNoCook && Boolean(meal.recipeId)))
    .map((day) => day.weekday);
}
