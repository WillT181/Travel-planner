import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Map View",
};

export default function MapPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-neutral-900">Map View</h1>
      <p className="mt-2 text-neutral-500">
        Visualise your destinations and route on an interactive map.
      </p>
    </div>
  );
}
