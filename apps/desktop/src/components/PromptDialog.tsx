import { useEffect, useState } from "react";

interface Props {
  open: boolean;
  title: string;
  message?: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel: string;
  /** Optional second action (e.g. copy without publish) */
  secondaryConfirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  /** Wider dialog for multi-button footers */
  wide?: boolean;
  children?: React.ReactNode;
  onConfirm: (value: string) => void;
  onSecondaryConfirm?: (value: string) => void;
  onCancel: () => void;
}

export default function PromptDialog({
  open,
  title,
  message,
  label,
  placeholder,
  defaultValue = "",
  confirmLabel,
  secondaryConfirmLabel,
  cancelLabel = "Cancel",
  confirmDisabled = false,
  wide = false,
  children,
  onConfirm,
  onSecondaryConfirm,
  onCancel,
}: Props) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (confirmDisabled) return;
    onConfirm(value.trim());
  }

  const hasSecondary = Boolean(secondaryConfirmLabel && onSecondaryConfirm);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onClick={onCancel}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-dialog-title"
        className={`cl-dialog ${wide || hasSecondary ? "max-w-xl" : "max-w-md"}`}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 id="prompt-dialog-title" className="text-base font-medium text-foreground">
          {title}
        </h2>
        {message && (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{message}</p>
        )}
        {children}
        <label className="cl-label mt-4">
          {label}
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="cl-input"
          />
        </label>
        <div
          className={
            hasSecondary
              ? "mt-5 flex flex-nowrap items-center justify-center gap-2"
              : "mt-5 flex flex-nowrap items-center justify-end gap-2"
          }
        >
          <button
            type="submit"
            disabled={confirmDisabled}
            className="cl-btn-export shrink-0 px-3 py-2 text-sm disabled:opacity-50"
          >
            {confirmLabel}
          </button>
          {hasSecondary && (
            <button
              type="button"
              onClick={() => onSecondaryConfirm!(value.trim())}
              className="cl-btn-ghost shrink-0 px-3 py-2 text-sm"
            >
              {secondaryConfirmLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="cl-btn-ghost shrink-0 px-3 py-2 text-sm"
          >
            {cancelLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
