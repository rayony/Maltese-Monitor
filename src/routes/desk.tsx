import { useEffect, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { deskChange, deskEnter, deskHide, deskLeave, deskReports, deskSetup, deskState } from "@/lib/admin.functions";
import { formatWhen } from "@/lib/soup";

type DeskRow = {
  id: string;
  brand: string;
  name: string;
  qty: string;
  at: string;
  hidden: boolean;
};

export const Route = createFileRoute("/desk")({
  loader: () => deskState(),
  component: DeskPage,
});

function messageOf(error: unknown) {
  if (error instanceof Error && error.message && !error.message.startsWith("Failed to")) return error.message;
  return "暫時做唔到，稍後再試";
}

function DeskPage() {
  const gate = Route.useLoaderData();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [nextConfirm, setNextConfirm] = useState("");
  const [rows, setRows] = useState<DeskRow[]>([]);
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!gate.signedIn) return;
    void deskReports()
      .then(setRows)
      .catch((error) => setStatus(messageOf(error)));
  }, [gate.signedIn]);

  async function run(action: () => Promise<void>, ok: string) {
    setPending(true);
    setStatus("");
    try {
      await action();
      setStatus(ok);
      await router.invalidate();
    } catch (error) {
      setStatus(messageOf(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-dvh bg-cream px-4 py-6 text-ink">
      <div className="mx-auto max-w-lg">
        <h1 className="text-xl font-bold">糾察管理</h1>
        <p className="mt-1 text-sm text-ink/70">隱藏一條之後，地圖會跌返去該舖上一條未隱藏嘅報料。其他舖唔受影響。</p>
        {status ? <p className="mt-3 text-sm">{status}</p> : null}

        {!gate.ready ? (
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                await deskSetup({ data: { password, confirm } });
                setPassword("");
                setConfirm("");
              }, "已設定。原文冇存低，只存咗雜湊。");
            }}
          >
            <p className="text-sm">第一次用。密碼最少 8 個字。資料庫只存雜湊，唔存原文。預覽入面設完，發佈後要再設一次。</p>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="新密碼"
              className="min-h-11 w-full rounded-xl border-2 border-ink bg-cream px-3"
            />
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="再打一次"
              className="min-h-11 w-full rounded-xl border-2 border-ink bg-cream px-3"
            />
            <button type="submit" disabled={pending} className="min-h-11 w-full rounded-xl border-2 border-ink bg-ink font-bold text-cream disabled:opacity-60">
              設定密碼
            </button>
          </form>
        ) : null}

        {gate.ready && !gate.signedIn ? (
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                await deskEnter({ data: { password } });
                setPassword("");
              }, "已進入");
            }}
          >
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="管理密碼"
              className="min-h-11 w-full rounded-xl border-2 border-ink bg-cream px-3"
            />
            <button type="submit" disabled={pending} className="min-h-11 w-full rounded-xl border-2 border-ink bg-ink font-bold text-cream disabled:opacity-60">
              進入
            </button>
          </form>
        ) : null}

        {gate.signedIn ? (
          <>
            <button
              type="button"
              className="mt-4 min-h-11 rounded-xl border-2 border-ink bg-paper px-4 text-sm"
              onClick={() => void run(() => deskLeave(), "已離開")}
            >
              離開
            </button>
            <ul className="mt-4 space-y-2">
              {rows.map((row) => (
                <li key={row.id} className="rounded-xl border-2 border-ink bg-paper px-3 py-2 text-sm">
                  <span className={`mr-2 inline-block rounded-full px-2 py-0.5 text-xs text-cream ${row.qty === "好多" ? "bg-moss" : "bg-soup"}`}>
                    {row.qty}
                  </span>
                  {row.hidden ? <span className="mr-2 text-ink/60">已隱藏</span> : null}
                  {row.brand} {row.name}
                  <span className="mt-1 block text-ink/70">{formatWhen(row.at)}</span>
                  <button
                    type="button"
                    disabled={pending}
                    className="mt-2 min-h-11 rounded-xl border-2 border-ink bg-cream px-3 text-sm disabled:opacity-60"
                    onClick={() =>
                      void run(async () => {
                        await deskHide({ data: { id: row.id, hidden: !row.hidden } });
                        setRows(await deskReports());
                      }, row.hidden ? "已復原" : "已隱藏")
                    }
                  >
                    {row.hidden ? "復原" : "隱藏"}
                  </button>
                </li>
              ))}
              {!rows.length ? <li className="rounded-xl border-2 border-ink bg-paper px-3 py-3 text-sm">近 7 日未有報料</li> : null}
            </ul>
            <form
              className="mt-6 space-y-3 border-t-2 border-dashed border-ink pt-4"
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  await deskChange({ data: { current, next, confirm: nextConfirm } });
                  setCurrent("");
                  setNext("");
                  setNextConfirm("");
                }, "密碼已更換，舊雜湊已覆蓋");
              }}
            >
              <p className="text-sm font-bold">換密碼</p>
              <input type="password" autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} placeholder="而家嘅密碼" className="min-h-11 w-full rounded-xl border-2 border-ink bg-cream px-3" />
              <input type="password" autoComplete="new-password" value={next} onChange={(event) => setNext(event.target.value)} placeholder="新密碼" className="min-h-11 w-full rounded-xl border-2 border-ink bg-cream px-3" />
              <input type="password" autoComplete="new-password" value={nextConfirm} onChange={(event) => setNextConfirm(event.target.value)} placeholder="再打一次新密碼" className="min-h-11 w-full rounded-xl border-2 border-ink bg-cream px-3" />
              <button type="submit" disabled={pending} className="min-h-11 w-full rounded-xl border-2 border-ink bg-paper text-sm font-bold disabled:opacity-60">
                更換
              </button>
            </form>
          </>
        ) : null}
      </div>
    </main>
  );
}
