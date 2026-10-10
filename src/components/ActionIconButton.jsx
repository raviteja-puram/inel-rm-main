const iconPaths = {
  edit: <path d="M4 15.5V20h4.5L18.9 9.6l-4.5-4.5L4 15.5Z" />,
  delete: <><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 14h10l1-14" /><path d="M9 7V4h6v3" /></>,
  confirm: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
};

const tones = {
  edit: 'border-[#6c63ff]/25 bg-[#6c63ff]/10 text-[#8f87ff] hover:bg-[#6c63ff]/20',
  delete: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
  confirm: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
};

function ActionIconButton({ type, label, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${tones[type] || tones.edit}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        {iconPaths[type] || iconPaths.edit}
      </svg>
    </button>
  );
}

export default ActionIconButton;
