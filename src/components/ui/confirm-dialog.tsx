"use client";
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Main body text. Can include JSX (e.g. <strong> for emphasis). */
  description: React.ReactNode;
  /**
   * When provided the user must type this exact string before the
   * confirm button is enabled — GitHub-style destructive confirmation.
   */
  confirmText?: string;
  /** Placeholder shown inside the text input when confirmText is set. */
  confirmPlaceholder?: string;
  onConfirm: () => void | Promise<void>;
  /** Label for the confirm button. Defaults to "Delete". */
  confirmLabel?: string;
  loading?: boolean;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  confirmPlaceholder,
  onConfirm,
  confirmLabel = "Delete",
  loading = false,
}: Props) {
  const [input, setInput] = useState("");

  const requiresTyping = !!confirmText;
  const canConfirm = !loading && (!requiresTyping || input === confirmText);

  async function handleConfirm() {
    await onConfirm();
    setInput("");
  }

  function handleOpenChange(next: boolean) {
    if (!next) setInput("");
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="space-y-3">
            <span className="block">{description}</span>
            {requiresTyping && (
              <span className="block">
                Type{" "}
                <code className="bg-zinc-100 px-1 rounded font-mono text-zinc-800">
                  {confirmText}
                </code>{" "}
                to confirm.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {requiresTyping && (
          <Input
            placeholder={confirmPlaceholder ?? confirmText}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && canConfirm && handleConfirm()}
            className="font-mono"
            autoFocus
          />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={!canConfirm} onClick={handleConfirm}>
            {loading ? "Deleting…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
