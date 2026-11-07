import * as fs from "fs";
import * as path from "path";

interface MetricFile {
  id: string;
  label: string;
  category: string;
  unit: string;
  higherIsBetter: boolean;
  description: string;
  source: string;
  sourceUrl: string;
  year: number;
  values: Record<string, number>;
}

export function generateSourcesTable(): string {
  const metricsDir = path.resolve(process.cwd(), "data/metrics");
  if (!fs.existsSync(metricsDir)) {
    return "No metrics found in `data/metrics/`.";
  }

  const files = fs.readdirSync(metricsDir).filter((f) => f.endsWith(".json")).sort();
  const rows: string[] = [
    "| Metric | Category | Source | Year | Unit | Coverage |",
    "| :--- | :--- | :--- | :---: | :--- | :---: |"
  ];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(metricsDir, file), "utf-8");
      const metric: MetricFile = JSON.parse(content);
      const townCount = Object.keys(metric.values || {}).length;
      const coverage = `${townCount}/42 towns`;
      const sourceLink = metric.sourceUrl ? `[${metric.source}](${metric.sourceUrl})` : metric.source;

      rows.push(`| **${metric.label}** (\`${metric.id}\`) | \`${metric.category}\` | ${sourceLink} | ${metric.year} | ${metric.unit} | ${coverage} |`);
    } catch (err) {
      console.error(`Error reading ${file}:`, err);
    }
  }

  return rows.join("\n");
}

export function updateReadmeWithSources(): void {
  const readmePath = path.resolve(process.cwd(), "README.md");
  if (!fs.existsSync(readmePath)) {
    console.warn("README.md not found.");
    return;
  }

  const table = generateSourcesTable();
  const readme = fs.readFileSync(readmePath, "utf-8");
  const startTag = "<!-- sources:start -->";
  const endTag = "<!-- sources:end -->";

  if (readme.includes(startTag) && readme.includes(endTag)) {
    const updated = readme.replace(
      new RegExp(`${startTag}[\\s\\S]*?${endTag}`),
      `${startTag}\n\n${table}\n\n${endTag}`
    );
    fs.writeFileSync(readmePath, updated, "utf-8");
    console.log("Updated README.md data sources table.");
  } else {
    console.log("Generated Table:\n\n" + table);
  }
}

if (process.argv[1]?.endsWith("sources-table.ts") || process.argv[1]?.endsWith("sources-table.js")) {
  updateReadmeWithSources();
}
