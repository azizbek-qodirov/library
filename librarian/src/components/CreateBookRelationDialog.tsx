import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useI18n } from '../../../shared/i18n';
import { readAPI } from './api';
import type { Author, Category, Publisher } from './types';

export type BookRelationKind = 'author' | 'publisher' | 'category';

const labels = {
    author: { title: 'Add New Author', name: 'Author Name *', error: 'Failed to save author. Please try again.' },
    publisher: { title: 'Add New Publisher', name: 'Publisher Name *', error: 'Failed to save publisher. Please try again.' },
    category: { title: 'Add New Category', name: 'Category Name *', error: 'Failed to save category. Please try again.' },
} as const;

interface Props {
    kind: BookRelationKind;
    initialName: string;
    onCreated: (record: Author | Publisher | Category) => void;
    onClose: () => void;
}

export default function CreateBookRelationDialog({ kind, initialName, onCreated, onClose }: Props) {
    const { t } = useI18n();
    const dialog = useRef<HTMLDialogElement>(null);
    const [name, setName] = useState(initialName);
    const [birthDate, setBirthDate] = useState('');
    const [details, setDetails] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(false);
    const isAuthor = kind === 'author';

    useEffect(() => {
        const element = dialog.current;
        element?.showModal();
        return () => element?.close();
    }, []);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving || !name.trim()) return;
        setSaving(true);
        setError(false);
        try {
            const result = await readAPI<{ author?: Author; publisher?: Publisher; category?: Category }>(`/${kind}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(isAuthor
                    ? { name: name.trim(), birth_date: birthDate || undefined, biography: details.trim() }
                    : { name: name.trim(), description: details.trim() }),
            });
            const created = result[kind];
            if (!created?.id) throw new Error('Missing created record');
            onCreated(created);
        } catch {
            setError(true);
            setSaving(false);
        }
    }

    return (
        <dialog ref={dialog} className="book-relation-dialog" aria-labelledby="book-relation-title"
            onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}>
            <form onSubmit={submit}>
                <div className="modal-header">
                    <h2 id="book-relation-title" className="modal-title fs-5">
                        {t(labels[kind].title)}
                    </h2>
                    <button type="button" className="btn-close" aria-label={t('Close')}
                        onClick={onClose} disabled={saving} />
                </div>
                <div className="modal-body">
                    <p className="text-muted small">{t('Only the name is required. You can add other details later.')}</p>
                    {error && <div className="alert alert-danger" role="alert">
                        {t(labels[kind].error)}
                    </div>}
                    <label className="form-label" htmlFor="book-relation-name">
                        {t(labels[kind].name)}
                    </label>
                    <input id="book-relation-name" className="form-control mb-3" value={name}
                        onChange={event => setName(event.target.value)} required autoFocus disabled={saving} />
                    {isAuthor && <>
                        <label className="form-label" htmlFor="book-relation-birth-date">{t('Birth Date')}</label>
                        <input id="book-relation-birth-date" type="date" className="form-control mb-3"
                            value={birthDate} onChange={event => setBirthDate(event.target.value)} disabled={saving} />
                    </>}
                    <label className="form-label" htmlFor="book-relation-details">
                        {t(isAuthor ? 'Biography' : 'Description')}
                    </label>
                    <textarea id="book-relation-details" className="form-control" rows={3} value={details}
                        onChange={event => setDetails(event.target.value)} disabled={saving} />
                </div>
                <div className="modal-footer gap-2">
                    <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
                        {t('Cancel')}
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
                        {saving ? t('Saving...') : t('Save and select')}
                    </button>
                </div>
            </form>
        </dialog>
    );
}
