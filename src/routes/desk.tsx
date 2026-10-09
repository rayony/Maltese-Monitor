import { useEffect, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { deskChange, deskEdit, deskEnter, deskHide, deskLeave, deskReports, deskSetup, deskState } from "@/lib/admin.functions";
import { clipNote, formatWhen, qtyChipClass, type Qty } from "@/lib/soup";

type DeskRow = {
  id: string;
  brand: string;
  name: string;
  qty: string;
  note: string;
  at: string;
  filedAt: string;
  hidden: boolean;
};

function hkInput(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}`;
}

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
  const [editing, setEditing] = useState<string | null>(null);
  const [draftQty, setDraftQty] = useState<Qty>("好多");
  const [draftNote, setDraftNote] = useState("");
  const [draftWhen, setDraftWhen] = useState("");
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
        <p className="mt-1 text-sm text-ink/70">可以改數量、留言同時間。隱藏只影響該舖，其他舖唔受影響。</p>
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
                  <span className={`mr-2 inline-block rounded-full px-2 py-0.5 text-xs ${qtyChipClass(row.qty)}`}>
                    {row.qty}
                  </span>
                  {row.hidden ? <span className="mr-2 text-ink/60">已隱藏</span> : null}
                  {row.brand} {row.name}
                  {row.note ? <span className="mt-1 block">{row.note}</span> : null}
                  <span className="mt-1 block text-ink/70">目擊 {formatWhen(row.at)} · 報料 {formatWhen(row.filedAt)}</span>
                  {editing === row.id ? (
                    <div className="mt-2 space-y-2">
                      <div className="flex gap-2">
                        {(["好多", "好少", "冇晒"] as const).map((item) => (
                          <button
                            key={item}
                            type="button"
                            className={`min-h-11 flex-1 rounded-xl border-2 border-ink text-sm font-bold ${draftQty === item ? qtyChipClass(item) : "bg-cream"}`}
                            onClick={() => setDraftQty(item)}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                      <input
                        value={draftNote}
                        maxLength={50}
                        placeholder="留言（可留空）"
                        onChange={(event) => setDraftNote(clipNote(event.target.value))}
                        className="min-h-11 w-full rounded-xl border-2 border-ink bg-cream px-3"
                      />
                      <p className="text-xs text-ink/60">{[...draftNote].length}/50</p>
                      <p className="text-xs font-bold">目擊時間</p>
                      <input
                        type="datetime-local"
                        value={draftWhen}
                        onChange={(event) => setDraftWhen(event.target.value)}
                        className="min-h-11 w-full rounded-xl border-2 border-ink bg-cream px-3"
                      />
                      <button
                        type="button"
                        disabled={pending}
                        className="min-h-11 rounded-xl border-2 border-ink bg-ink px-3 text-sm font-bold text-cream disabled:opacity-60"
                        onClick={() =>
                          void run(async () => {
                            await deskEdit({ data: { id: row.id, qty: draftQty, note: draftNote, at: new Date(draftWhen).toISOString() } });
                            setRows(await deskReports());
                            setEditing(null);
                          }, "已改好")
                        }
                      >
                        儲存
                      </button>
                    </div>
                  ) : null}
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      className="min-h-11 rounded-xl border-2 border-ink bg-cream px-3 text-sm disabled:opacity-60"
                      onClick={() => {
                        if (editing === row.id) {
                          setEditing(null);
                          return;
                        }
                        setEditing(row.id);
                        setDraftQty(row.qty === "好少" || row.qty === "冇晒" ? row.qty : "好多");
                        setDraftNote(row.note);
                        setDraftWhen(hkInput(row.at));
                      }}
                    >
                      {editing === row.id ? "取消" : "修改"}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      className="min-h-11 rounded-xl border-2 border-ink bg-cream px-3 text-sm disabled:opacity-60"
                      onClick={() =>
                        void run(async () => {
                          await deskHide({ data: { id: row.id, hidden: !row.hidden } });
                          setRows(await deskReports());
                        }, row.hidden ? "已復原" : "已隱藏")
                      }
                    >
                      {row.hidden ? "復原" : "隱藏"}
                    </button>
                  </div>
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
