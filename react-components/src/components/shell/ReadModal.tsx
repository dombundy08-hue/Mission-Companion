interface ReadModalProps {
  date: string;
  body: string;
  onClose: () => void;
  onDelete: () => void;
}

// Ported from index.html's openReadModal()/closeReadModal() shared modal.
export function ReadModal({ date, body, onClose, onDelete }: ReadModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-[420px] rounded-2xl p-[22px]"
        style={{ background: 'var(--card)', boxShadow: 'var(--shadow-lg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-2 font-heading text-lg font-semibold" style={{ color: 'var(--navy)' }}>
          {date}
        </h3>
        <div className="max-h-[50vh] overflow-auto whitespace-pre-wrap text-sm" style={{ color: 'var(--foreground)' }}>
          {body}
        </div>
        <div className="mt-4 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl py-3 text-sm font-medium"
            style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex-1 rounded-xl py-3 text-sm font-bold text-white"
            style={{ background: 'var(--primary)', boxShadow: '0 2px 0 var(--gold-dark)' }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
