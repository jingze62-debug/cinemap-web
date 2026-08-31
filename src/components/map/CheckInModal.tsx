"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

type CheckInModalProps = {
  open: boolean;
  cinemaName: string;
  onClose: () => void;
  onConfirm: (note?: string) => void;
};

export function CheckInModal({
  open,
  cinemaName,
  onClose,
  onConfirm,
}: CheckInModalProps) {
  const [note, setNote] = useState("");

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[550] flex items-end justify-center bg-ink/35 p-4 pb-2 sm:items-center">
      <div
        role="dialog"
        aria-modal
        aria-label="影院打卡"
        className="w-full max-w-sm rounded-2xl border border-ink/10 bg-paper p-4 text-ink shadow-xl"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] tracking-[0.18em] text-ink/40">
              CHECK IN
            </p>
            <h3 className="mt-1 font-display text-lg font-semibold">
              点亮 · {cinemaName}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-ink/40 hover:bg-ink/5"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <label className="mt-4 block text-xs text-ink/50">
          小纸条（可选）
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="今天这场的观感、避坑备注…"
            className="mt-1.5 w-full resize-none rounded-xl border border-ink/10 bg-white/80 px-3 py-2 text-sm text-ink placeholder:text-ink/30 outline-none focus:ring-2 focus:ring-accent/30"
          />
        </label>
        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onClose}
          >
            取消
          </Button>
          <Button
            type="button"
            variant="accent"
            className="flex-1"
            onClick={() => {
              onConfirm(note.trim() || undefined);
              setNote("");
            }}
          >
            确认点亮
          </Button>
        </div>
      </div>
    </div>
  );
}
