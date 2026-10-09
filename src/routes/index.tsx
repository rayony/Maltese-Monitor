import { createFileRoute } from "@tanstack/react-router";
import { PatrolApp } from "@/components/patrol-app";
import { listReports } from "@/lib/reports.functions";

export const Route = createFileRoute("/")({
  loader: () => listReports(),
  component: Home,
});

function Home() {
  const reports = Route.useLoaderData();
  return <PatrolApp initialReports={reports} />;
}
