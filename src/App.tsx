import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

export default function App() {
  const cities = useQuery(api.cities.list);
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold">Utah Fit</h1>
      <p className="text-gray-600">{cities === undefined ? "Loading…" : `${cities.length} towns`}</p>
    </main>
  );
}
