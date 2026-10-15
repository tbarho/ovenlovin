export function formatPlannedDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function recipeDeleteConfirmCopy(
  title: string,
  plannedDates: string[]
): { title: string; body: string } {
  const nights = plannedDates.map(formatPlannedDate);
  const when =
    nights.length === 0
      ? ""
      : nights.length === 1
        ? ` It's on the plan for ${nights[0]}.`
        : ` It's on the plan for ${nights.slice(0, -1).join(", ")} and ${nights.at(-1)}.`;
  return {
    title: `Delete ${title}?`,
    body: `This removes the recipe from your kitchen.${when} You can undo right after.`,
  };
}
