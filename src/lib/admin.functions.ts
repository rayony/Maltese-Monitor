import { createServerFn } from "@tanstack/react-start";

export const deskState = createServerFn({ method: "GET" }).handler(async () => {
  const { readState } = await import("@/lib/admin-lock.server");
  return readState();
});

export const deskSetup = createServerFn({ method: "POST" })
  .validator((input: { password: string; confirm: string }) => input)
  .handler(async ({ data }) => {
    const { setupPassword } = await import("@/lib/admin-lock.server");
    await setupPassword(String(data?.password ?? ""), String(data?.confirm ?? ""));
  });

export const deskEnter = createServerFn({ method: "POST" })
  .validator((input: { password: string }) => input)
  .handler(async ({ data }) => {
    const { enterPassword } = await import("@/lib/admin-lock.server");
    await enterPassword(String(data?.password ?? ""));
  });

export const deskLeave = createServerFn({ method: "POST" }).handler(async () => {
  const { leaveDesk } = await import("@/lib/admin-lock.server");
  await leaveDesk();
});

export const deskChange = createServerFn({ method: "POST" })
  .validator((input: { current: string; next: string; confirm: string }) => input)
  .handler(async ({ data }) => {
    const { changePassword } = await import("@/lib/admin-lock.server");
    await changePassword(String(data?.current ?? ""), String(data?.next ?? ""), String(data?.confirm ?? ""));
  });

export const deskReports = createServerFn({ method: "GET" }).handler(async () => {
  const { listDesk } = await import("@/lib/admin-lock.server");
  return listDesk();
});

export const deskHide = createServerFn({ method: "POST" })
  .validator((input: { id: string; hidden: boolean }) => input)
  .handler(async ({ data }) => {
    const { setHidden } = await import("@/lib/admin-lock.server");
    await setHidden(String(data?.id ?? ""), Boolean(data?.hidden));
  });

export const deskEdit = createServerFn({ method: "POST" })
  .validator((input: { id: string; qty: string; note: string; at: string }) => input)
  .handler(async ({ data }) => {
    const { updateReport } = await import("@/lib/admin-lock.server");
    await updateReport({
      id: String(data?.id ?? ""),
      qty: String(data?.qty ?? ""),
      note: String(data?.note ?? ""),
      at: String(data?.at ?? ""),
    });
  });
