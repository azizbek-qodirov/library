import { useI18n } from '../../../shared/i18n';
import { Icon } from '../../../shared/Icon';
import { usePaginatedList } from './usePaginatedList';
import { readAPI, staffFetch } from './api';
import React, { useEffect, useState, useRef } from 'react';
import type { Book, BookFormData } from './types';
import { API_BASE_URL } from './types';
import BookEditor from './BookEditor';
import CopyLabels from './CopyLabels';

interface SavedData {
    showForm?: boolean;
    formData?: BookFormData;
    editingBook?: Book | null;
    searchQuery?: string;
    imagePreview?: string | null;
}

interface Props {
    savedData?: SavedData;
    onDataChange: (data: SavedData | null) => void;
}

const BooksSection: React.FC<Props> = ({ savedData, onDataChange }) => {
  const { t } = useI18n();
    const [searchQuery, setSearchQuery] = useState(savedData?.searchQuery ?? '');
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState<BookFormData>({
        title: '',
        isbn: '',
        location: '',
        is_reference_only: false,
        description: '',
        published_date: '',
        publication_year: '',
        publisher_id: '',
        language: '',
        page_count: 0,
        total_copies: 0,
        category_ids: [],
        author_ids: [],
        cover_image_file: null,
        cover_image_id: ''
    });
    const [labelBook, setLabelBook] = useState<Book | null>(null);
    const [editingBook, setEditingBook] = useState<Book | null>(null);
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; book: Book | null }>({
        isOpen: false,
        book: null
    });
    const [actionLoading, setActionLoading] = useState(false);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const previewReader = useRef<FileReader | null>(null);
    const actionAbortController = useRef<AbortController | null>(null);

    useEffect(() => {
        return () => {
            previewReader.current?.abort();
            if (actionAbortController.current) {
                actionAbortController.current.abort();
            }
        };
    }, []);

    const itemsPerPage = 20;
    const {
      items: books, total: totalBooks, loading, error, currentPage, setCurrentPage, reload: fetchBooks,
    } = usePaginatedList<Book>('/books', t("books"), 'total_count', searchQuery);
    const totalPages = Math.ceil(totalBooks / itemsPerPage);

    // Restore saved data
    useEffect(() => {
        if (savedData) {
            if (savedData.showForm) setShowForm(true);
            if (savedData.formData) setFormData(savedData.formData);
            if (savedData.editingBook) setEditingBook(savedData.editingBook);
            if (savedData.searchQuery) setSearchQuery(savedData.searchQuery);
            if (savedData.imagePreview) setImagePreview(savedData.imagePreview);
        }
    }, [savedData]);


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate file type
            if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
                alert(t("Choose a JPEG, PNG, GIF, or WebP image."));
                return;
            }

            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                alert(t("File size must be less than 5MB"));
                return;
            }

            setFormData(prev => ({ ...prev, cover_image_file: file }));

            // Create preview
            previewReader.current?.abort();
            const reader = new FileReader();
            previewReader.current = reader;
            reader.onload = () => {
                if (typeof reader.result === 'string') setImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const uploadFile = async (file: File, signal: AbortSignal): Promise<string> => {
        const formDataFile = new FormData();
        formDataFile.append('file', file);

        const record = await readAPI<{ id: string }>('/file', {
            method: 'POST',
            body: formDataFile,
            signal
        });

        return record.id;
    };

    const handleSave = async () => {
        const year = Number(formData.publication_year);
        if (formData.publication_year && (!Number.isInteger(year) || year < 1 || year > 9999)) {
            alert(t("Edition year must be between 1 and 9999."));
            return;
        }
        if (!formData.title.trim()) {
            alert(t("Title is required"));
            return;
        }

        // Create new AbortController for this operation
        actionAbortController.current = new AbortController();
        const signal = actionAbortController.current.signal;

        setActionLoading(true);
        let uploadedCoverID: string | undefined;
        try {
            let coverImageId = formData.cover_image_id;

            // Upload file first if new file is selected
            if (formData.cover_image_file) {
                uploadedCoverID = await uploadFile(formData.cover_image_file, signal);
                coverImageId = uploadedCoverID;
            }

            const bookData = {
                title: formData.title,
                isbn: formData.isbn,
                location: formData.location,
                is_reference_only: formData.is_reference_only,
                description: formData.description,
                published_date: formData.published_date || undefined,
                publication_year: formData.publication_year ? Number(formData.publication_year) : 0,
                publisher_id: formData.publisher_id,
                language: formData.language,
                page_count: parseInt(formData.page_count.toString()) || 0,
                total_copies: parseInt(formData.total_copies.toString()) || 0,
                category_ids: formData.category_ids,
                author_ids: formData.author_ids,
                cover_image_id: coverImageId
            };

            await readAPI(editingBook ? `/book/${editingBook.id}` : '/book', {
                method: editingBook ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookData),
                signal,
            });

            actionAbortController.current = null;
            handleCancelForm();
            fetchBooks();
            alert(t(editingBook ? "Book updated successfully!" : "Book created successfully!"));
        } catch (error) {
            if (uploadedCoverID) {
                // A timed-out save may have committed. The API refuses to delete attached covers.
                try {
                    await readAPI(`/file/${uploadedCoverID}`, { method: 'DELETE', signal: AbortSignal.timeout(16000) });
                } catch (cleanupError) {
                    console.warn('Could not clean up unused cover', uploadedCoverID, cleanupError);
                }
            }
            if (error instanceof Error && error.name === 'AbortError') {
                // Operation was cancelled, do nothing
                return;
            }
            console.error('Error saving book:', error);
            alert(t("Failed to save book.") + " " + (error instanceof Error ? error.message : t("Please try again.")));
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteModal.book) return;

        // Create new AbortController for this operation
        actionAbortController.current = new AbortController();
        const signal = actionAbortController.current.signal;

        setActionLoading(true);
        try {
            const response = await staffFetch(`${API_BASE_URL}/book/${deleteModal.book.id}`, {
                method: 'DELETE',
                signal
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || t("Failed to delete book"));
            }

            actionAbortController.current = null;
            setDeleteModal({ isOpen: false, book: null });
            fetchBooks();
            alert(t("Book deleted successfully!"));
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                // Operation was cancelled, do nothing
                return;
            }
            console.error('Error deleting book:', error);
            alert(t("Failed to delete book") + " " + (error instanceof Error ? error.message : t("Please try again.")));
        } finally {
            setActionLoading(false);
        }
    };

    const handleCancelForm = () => {
        // Abort any ongoing operation
        if (actionAbortController.current) {
            actionAbortController.current.abort();
            actionAbortController.current = null;
        }
        previewReader.current?.abort();
        setActionLoading(false);
        setShowForm(false);
        setEditingBook(null);
        setFormData({
            title: '',
            isbn: '',
            location: '',
            is_reference_only: false,
            description: '',
            published_date: '',
            publication_year: '',
            publisher_id: '',
            language: '',
            page_count: 0,
            total_copies: 0,
                category_ids: [],
            author_ids: [],
            cover_image_file: null,
            cover_image_id: ''
        });
        setImagePreview(null);
        onDataChange(null);
    };

    const saveCurrentState = () => {
        if (showForm || searchQuery) {
            onDataChange({
                showForm,
                formData,
                editingBook,
                searchQuery,
                imagePreview
            });
        }
    };

    const renderPagination = () => {
        if (totalPages <= 1) return null;

        const pages = [];
        const delta = 2;

        pages.push(
            <button
                key="prev"
                className="btn btn-outline-primary btn-sm me-1"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
            >
                {t("« Prev")}
            </button>
        );

        let rangeStart = Math.max(1, currentPage - delta);
        let rangeEnd = Math.min(totalPages, currentPage + delta);

        if (currentPage <= delta + 1) {
            rangeEnd = Math.min(totalPages, delta * 2 + 2);
        }
        if (currentPage >= totalPages - delta) {
            rangeStart = Math.max(1, totalPages - delta * 2 - 1);
        }

        if (rangeStart > 1) {
            pages.push(
                <button
                    key={1}
                    className={`btn btn-sm me-1 ${1 === currentPage ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setCurrentPage(1)}
                >
                    1
                </button>
            );
            if (rangeStart > 2) {
                pages.push(<span key="ellipsis1" className="me-1 px-2">...</span>);
            }
        }

        for (let i = rangeStart; i <= rangeEnd; i++) {
            pages.push(
                <button
                    key={i}
                    className={`btn btn-sm me-1 ${i === currentPage ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setCurrentPage(i)}
                >
                    {i}
                </button>
            );
        }

        if (rangeEnd < totalPages) {
            if (rangeEnd < totalPages - 1) {
                pages.push(<span key="ellipsis2" className="me-1 px-2">...</span>);
            }
            pages.push(
                <button
                    key={totalPages}
                    className={`btn btn-sm me-1 ${totalPages === currentPage ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setCurrentPage(totalPages)}
                >
                    {totalPages}
                </button>
            );
        }

        pages.push(
            <button
                key="next"
                className="btn btn-outline-primary btn-sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
            >
                {t("Next »")}
            </button>
        );

        return <div className="d-flex flex-wrap row-gap-2 justify-content-center align-items-center mt-4">{pages}</div>;
    };

    if (showForm) {
        return <BookEditor
            editingBook={editingBook}
            formData={formData}
            setFormData={setFormData}
            imagePreview={imagePreview}
            actionLoading={actionLoading}
            handleFileChange={handleFileChange}
            handleSave={handleSave}
            handleCancelForm={handleCancelForm}
        />;
    }

    return (
        <div onClick={saveCurrentState}>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h3 className="mb-1">{t("Books Management")}</h3>
                    <p className="text-muted mb-0">{t("Manage library book inventory")}</p>
                </div>
                <button className="btn btn-primary d-flex align-items-center gap-2" onClick={() => setShowForm(true)}>
                    <span aria-hidden="true">+</span>
                    {t("Add New Book")}
                </button>
            </div>

            {/* Search Card */}
            <div className="card mb-4 shadow-sm">
                <div className="card-header bg-light">
                    <h6 className="mb-0">{t("Search Books")}</h6>
                </div>
                <div className="card-body">
                    <input
                        type="text"
                        className="form-control"
                        placeholder={t("Search by title, author, ISBN, or barcode…")}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Error Alert */}
            {error && (
                <div className="alert alert-danger alert-dismissible" role="alert">
                    <strong>{t("Error!")}</strong> {t("Could not load records.")}
                    <button type="button" className="btn btn-outline-danger btn-sm ms-2" onClick={fetchBooks}>{t("Retry")}</button>
                </div>
            )}

            {labelBook && <CopyLabels key={labelBook.id} book={labelBook} onClose={() => setLabelBook(null)} />}

            {/* Books Table */}
            <div className="card shadow-sm">
                <div className="card-header bg-white">
                    <div className="row align-items-center">
                        <div className="col">
                            <h6 className="mb-0">{t("All Books")}</h6>
                        </div>
                        <div className="col-auto">
                            <div className="d-flex gap-4 small text-muted">
                                <span>{t("Total:")} <strong>{totalBooks}</strong></span>
                                {totalPages > 1 && <span>{t("Page {page} of {total}", { page: currentPage, total: totalPages })}</span>}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="card-body p-0">
                    {loading ? (
                        <div className="text-center p-5">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">{t("Loading...")}</span>
                            </div>
                            <p className="mt-3 text-muted">{t("Loading books...")}</p>
                        </div>
                    ) : books.length === 0 ? (
                        <div className="text-center p-5">
                            <div className="text-muted mb-3" style={{ fontSize: '3rem' }}><Icon name="library" size={28} /></div>
                            <h5>{t("No Books Found")}</h5>
                            <p className="text-muted mb-4">
                                {searchQuery
                                    ? t("No books match your search query.")
                                    : t("No books have been added yet.")
                                }
                            </p>
                            {!searchQuery && (
                                <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                                    {t("Add First Book")}
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover mb-0 library-record-table" role="table">
                                <thead role="rowgroup" className="table-light">
                                    <tr role="row">
                                        <th role="columnheader" scope="col" className="border-0 fw-semibold" style={{ width: '80px' }}>{t("Cover")}</th>
                                        <th role="columnheader" scope="col" className="border-0 fw-semibold">{t("Title")}</th>
                                        <th role="columnheader" scope="col" className="border-0 fw-semibold">{t("Authors")}</th>
                                        <th role="columnheader" scope="col" className="border-0 fw-semibold">{t("ISBN")}</th>
                                        <th role="columnheader" scope="col" className="border-0 fw-semibold">{t("Location")}</th>
                                        <th role="columnheader" scope="col" className="border-0 fw-semibold">{t("Copies")}</th>
                                        <th role="columnheader" scope="col" className="border-0 fw-semibold text-end">{t("Actions")}</th>
                                    </tr>
                                </thead>
                                <tbody role="rowgroup">
                                    {books.map((book) => (
                                        <tr role="row" key={book.id}>
                                            <td role="cell" data-label={t("Cover")} className="py-3">
                                                {book.cover_image_id?.url ? (
                                                    <img
                                                        src={book.cover_image_id.url}
                                                        alt={book.title}
                                                        style={{ width: '50px', height: '70px', objectFit: 'cover' }}
                                                        className="rounded shadow-sm"
                                                    />
                                                ) : (
                                                    <div
                                                        className="bg-light d-flex align-items-center justify-content-center rounded border"
                                                        style={{ width: '50px', height: '70px', fontSize: '1.5rem' }}
                                                    >
                                                        <Icon name="book" size={28} />
                                                    </div>
                                                )}
                                            </td>
                                            <td role="cell" data-label={t("Title")} className="py-3">
                                                <div className="fw-medium">{book.title}</div>
                                                {book.is_reference_only && (
                                                    <span className="badge bg-warning text-dark small mt-1">{t("Reference Only")}</span>
                                                )}
                                            </td>
                                            <td role="cell" data-label={t("Authors")} className="py-3 text-muted small">
                                                {(book.author_ids?.length ?? 0) > 0 ? book.author_ids?.map(a => a.name).join(', ') : '-'}
                                            </td>
                                            <td role="cell" data-label={t("ISBN")} className="py-3 text-muted">{book.isbn || "—"}</td>
                                            <td role="cell" data-label={t("Location")} className="py-3 text-muted">{book.location || '-'}</td>
                                            <td role="cell" data-label={t("Copies")} className="py-3">
                                                <span className={`badge ${(book.available_copies ?? 0) > 0 ? 'bg-success' : 'bg-danger'}`}>
                                                    {book.available_copies ?? 0}/{book.total_copies ?? 0}
                                                </span>
                                            </td>
                                            <td role="cell" data-label={t("Actions")} className="py-3 text-end">
                                                <div className="btn-group btn-group-sm">
                                                    <button
                                                        className="btn btn-outline-primary"
                                                        onClick={() => {
                                                            setEditingBook(book);
                                                            setFormData({
                                                                title: book.title,
                                                                isbn: book.isbn ?? '',
                                                                location: book.location ?? '',
                                                                is_reference_only: book.is_reference_only ?? false,
                                                                description: book.description ?? '',
                                                                published_date: book.published_date ? book.published_date.split('T')[0] : '',
                                                                publication_year: book.publication_year?.toString() ?? '',
                                                                publisher_id: book.publisher_id?.id || '',
                                                                language: book.language ?? '',
                                                                page_count: book.page_count ?? 0,
                                                                total_copies: book.total_copies ?? 0,
                                                                category_ids: book.category_ids?.map(c => c.id) ?? [],
                                                                author_ids: book.author_ids?.map(a => a.id) ?? [],
                                                                cover_image_file: null,
                                                                cover_image_id: book.cover_image_id?.id || ''
                                                            });
                                                            setImagePreview(book.cover_image_id?.url || null);
                                                            setShowForm(true);
                                                        }}
                                                        title={t("Edit book")}
                                                    >
                                                        {t("Edit")}
                                                    </button>
                                                    <button className="btn btn-outline-secondary" onClick={() => setLabelBook(book)}>
                                                        {t("Labels")}
                                                    </button>
                                                    <button
                                                        className="btn btn-outline-danger"
                                                        onClick={() => setDeleteModal({ isOpen: true, book })}
                                                        title={t("Delete book")}
                                                    >
                                                        {t("Delete")}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {renderPagination()}

            {/* Delete Confirmation Modal */}
            {deleteModal.isOpen && (
                <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content shadow">
                            <div className="modal-header border-0 pb-0">
                                <h5 className="modal-title text-danger">{t("Confirm Delete")}</h5>
                                <button type="button" className="btn-close" aria-label={t("Close")} onClick={() => setDeleteModal({ isOpen: false, book: null })}></button>
                            </div>
                            <div className="modal-body">
                                <div className="text-center mb-3">
                                    <div className="text-danger mb-3" style={{ fontSize: '3rem' }}><Icon name="warning" size={28} /></div>
                                    <p className="mb-2">{t("Are you sure you want to delete “{name}”?", { name: deleteModal.book?.title ?? "" })}</p>
                                    <p className="text-muted small">{t("This action cannot be undone.")}</p>
                                </div>
                            </div>
                            <div className="modal-footer border-0 pt-0">
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary"
                                    onClick={() => {
                                        if (actionAbortController.current) {
                                            actionAbortController.current.abort();
                                            actionAbortController.current = null;
                                        }
                                        setActionLoading(false);
                                        setDeleteModal({ isOpen: false, book: null });
                                    }}
                                >
                                    {t("Cancel")}
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-danger"
                                    onClick={handleDelete}
                                    disabled={actionLoading}
                                >
                                    {actionLoading ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2"></span>
                                            {t("Deleting...")}
                                        </>
                                    ) : (
                                        t("Delete")
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BooksSection;