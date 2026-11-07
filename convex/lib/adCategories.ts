/** Each category names the real town metric shown beside its campaigns, when one fits. */
export const AD_CATEGORIES = {
  food: { label: "Food and drink", metricId: "restaurants_per_1k" },
  recreation: { label: "Recreation", metricId: "venues" },
  outdoor: { label: "Outdoor", metricId: "trails" },
  tech_jobs: { label: "Tech and jobs", metricId: "tech_employers" },
  services: { label: "Services" },
  retail: { label: "Retail" },
  health: { label: "Health" },
  other: { label: "Other" },
} as const satisfies Record<string, { label: string; metricId?: string }>;

export type AdCategory = keyof typeof AD_CATEGORIES;

export const AD_CATEGORY_IDS = Object.keys(AD_CATEGORIES) as AdCategory[];
