import { createFileRoute } from "@tanstack/react-router";
import { createReport, listPublicReports, type ReportInput } from "@/lib/reports.functions";

function fail(error: unknown, status = 400) {
  const message = error instanceof Error && error.message ? error.message : "交唔到";
  return Response.json({ error: message }, { status });
}

export const Route = createFileRoute("/api/reports")({
  server: {
    handlers: {
      GET: async () => {
        try {
          return Response.json(await listPublicReports());
        } catch (error) {
          return fail(error, 500);
        }
      },
      POST: async ({ request }) => {
        let body: ReportInput;
        try {
          body = (await request.json()) as ReportInput;
        } catch {
          return Response.json({ error: "需要 JSON" }, { status: 400 });
        }
        try {
          return Response.json(await createReport(body), { status: 201 });
        } catch (error) {
          return fail(error);
        }
      },
    },
  },
});
