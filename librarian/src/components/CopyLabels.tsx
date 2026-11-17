import { useI18n } from '../../../shared/i18n';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Book, BookCopy } from '../../../shared/library-api';
import { readAPI } from './api';

const copyStatus = {
    available: 'Available',
    borrowed: 'Borrowed',
    lost: 'Lost',
    retired: 'Retired',
} as const;

const code39Widths: Record<string, number> = {
    '0': 0x034, '1': 0x121, '2': 0x061, '3': 0x160, '4': 0x031,
    '5': 0x130, '6': 0x070, '7': 0x025, '8': 0x124, '9': 0x064,
    O: 0x112, X: 0x091, '-': 0x085, '*': 0x094,
};

function BarcodeLabel({ barcode, title }: { barcode: string; title: string }) {
    let offset = 12;
    const bars: { start: number; width: number }[] = [];
    for (const symbol of `*${barcode}*`) {
        const pattern = code39Widths[symbol];
        for (let index = 0; index < 9; index++) {
            const width = (pattern & (1 << (8 - index))) ? 3 : 1;
            if (index % 2 === 0) bars.push({ start: offset, width });
            offset += width;
        }
        offset++;
    }
    const width = offset + 12;
    return (
        <div className="copy-print-label">
            <div>{title}</div>
            <svg viewBox={`0 0 ${width} 52`} width={width * 2} height="52" role="img" aria-label={barcode}
                style={{ maxWidth: '100%' }}>
                <rect width={width} height="52" fill="white" />
                {bars.map(bar => <rect key={bar.start} x={bar.start} width={bar.width} height="52" fill="black" />)}
            </svg>
            <div><code>{barcode}</code></div>
        </div>
    );
}

export default function CopyLabels({ book, onClose }: { book: Book; onClose: () => void }) {
  const { t } = useI18n();
    const [copies, setCopies] = useState<BookCopy[] | null>(null);
    const [error, setError] = useState(false);
    useEffect(() => {
        const controller = new AbortController();
        readAPI<{ copies?: BookCopy[] }>(`/book/${book.id}/copies`, { signal: controller.signal })
            .then(result => setCopies(result.copies ?? []))
            .catch(() => {
                if (!controller.signal.aborted) setError(true);
            });
        return () => controller.abort();
    }, [book.id]);

    const active = copies?.filter(copy => copy.status !== 'retired') ?? [];
    return (
        <section className="card mb-4" aria-label={t("Copy labels")}>
            <div className="card-body">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                    <h4 className="h6 mb-0">{t("Copy labels ·")} {book.title}</h4>
                    <div className="d-flex gap-2">
                        <button className="btn btn-sm btn-primary" disabled={!active.length} onClick={() => window.print()}>
                            {t("Print labels")}
                        </button>
                        <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>{t("Close")}</button>
                    </div>
                </div>
                {error && <p className="text-danger mt-2 mb-0" role="alert">{t("Could not load copy labels.")}</p>}
                {!copies && !error && <p className="text-muted mt-2 mb-0" role="status">{t("Loading copies…")}</p>}
                {copies?.length === 0 && <p className="text-muted mt-2 mb-0">{t("No copies. Increase the copy count to create labels.")}</p>}
                {copies && copies.length > 0 && (
                    <ul className="list-group list-group-flush mt-3">
                        {copies.map(copy => (
                            <li className="list-group-item px-0 d-flex justify-content-between gap-2" key={copy.id}>
                                <code>{copy.barcode}</code>
                                <span className="text-capitalize">{t(copy.status ? copyStatus[copy.status] : "Unknown")}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            {active.length > 0 && createPortal(
                <section className="library-copy-print" aria-label={t("Printable copy labels")}>
                    {active.map(copy => <BarcodeLabel key={copy.id} barcode={copy.barcode} title={book.title} />)}
                </section>, document.body)}
        </section>
    );
}
