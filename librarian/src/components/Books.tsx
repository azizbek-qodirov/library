import React, { useCallback, useEffect, useState, useRef } from 'react';
import type { Author, Book, BookFormData, Category, Publisher } from './types';
import { API_BASE_URL } from './types';
import SearchableSelect from './SearchableSelect';

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
    const [books, setBooks] = useState<Book[]>([]);
    const [authors, setAuthors] = useState<Author[]>([]);
    const [publishers, setPublishers] = useState<Publisher[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(false);
    const [dataLoading, setDataLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalBooks, setTotalBooks] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState<BookFormData>({
        title: '',
        isbn: '',
        location: '',
        is_reference_only: false,
        description: '',
        published_date: '',
        publisher_id: '',
        language: '',
        page_count: 0,
        total_copies: 0,
        available_copies: 0,
        category_ids: [],
        author_ids: [],
        cover_image_file: null,
        cover_image_id: ''
    });
    const [editingBook, setEditingBook] = useState<Book | null>(null);
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; book: Book | null }>({
        isOpen: false,
        book: null
    });
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const isMountedRef = useRef(true);
    const actionAbortController = useRef<AbortController | null>(null);

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
            if (actionAbortController.current) {
                actionAbortController.current.abort();
            }
        };
    }, []);

    const itemsPerPage = 20;
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

    const fetchAuthors = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/authors?limit=100&offset=0`);
            if (!response.ok) {
                throw new Error(`Failed to fetch authors: ${response.statusText}`);
            }
            const data = await response.json();
            setAuthors(data.authors || []);
        } catch (error) {
            console.error('Error fetching authors:', error);
            setError(error instanceof Error ? error.message : 'Failed to load authors. Some features may be limited.');
        }
    }, []);

    const fetchPublishers = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/publishers?limit=100&offset=0`);
            if (!response.ok) {
                throw new Error(`Failed to fetch publishers: ${response.statusText}`);
            }
            const data = await response.json();
            setPublishers(data.publishers || []);
        } catch (error) {
            console.error('Error fetching publishers:', error);
            setError(error instanceof Error ? error.message : 'Failed to load publishers. Some features may be limited.');
        }
    }, []);

    const fetchCategories = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/categories?limit=100&offset=0`);
            if (!response.ok) {
                throw new Error(`Failed to fetch categories: ${response.statusText}`);
            }
            const data = await response.json();
            setCategories(data.categories || []);
        } catch (error) {
            console.error('Error fetching categories:', error);
            setError(error instanceof Error ? error.message : 'Failed to load categories. Some features may be limited.');
        }
    }, []);

    const fetchBooks = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            params.append('limit', itemsPerPage.toString());
            params.append('offset', ((currentPage - 1) * itemsPerPage).toString());
            if (searchQuery.trim()) params.append('search', searchQuery.trim());

            const response = await fetch(`${API_BASE_URL}/books?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch books');

            const data = await response.json();
            setBooks(data.books || []);
            setTotalBooks(data.total_count || 0);
        } catch (error) {
            console.error('Error fetching books:', error);
            setError('Failed to fetch books. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [currentPage, searchQuery, itemsPerPage]);

    // Fetch initial data
    useEffect(() => {
        const loadData = async () => {
            setDataLoading(true);
            await Promise.all([
                fetchAuthors(),
                fetchPublishers(),
                fetchCategories()
            ]);
            setDataLoading(false);
        };
        loadData();
    }, [fetchAuthors, fetchPublishers, fetchCategories]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            setCurrentPage(1);
            fetchBooks();
        }, 1000);
        return () => clearTimeout(timer);
    }, [searchQuery, fetchBooks]);

    useEffect(() => {
        fetchBooks();
    }, [currentPage, fetchBooks]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                alert('Please select an image file');
                return;
            }

            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                alert('File size must be less than 5MB');
                return;
            }

            setFormData(prev => ({ ...prev, cover_image_file: file }));

            // Create preview
            const reader = new FileReader();
            reader.onloadend = () => {
                if (isMountedRef.current) {
                    setImagePreview(reader.result as string);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const uploadFile = async (file: File, signal: AbortSignal): Promise<string> => {
        const formDataFile = new FormData();
        formDataFile.append('file', file);

        const response = await fetch(`${API_BASE_URL}/file`, {
            method: 'POST',
            body: formDataFile,
            signal
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Failed to upload file');
        }

        const data = await response.json();
        return data.id;
    };

    const handleSave = async () => {
        if (!formData.title.trim() || !formData.isbn.trim()) {
            alert('Title and ISBN are required');
            return;
        }

        // Create new AbortController for this operation
        actionAbortController.current = new AbortController();
        const signal = actionAbortController.current.signal;

        setActionLoading(true);
        try {
            let coverImageId = formData.cover_image_id;

            // Upload file first if new file is selected
            if (formData.cover_image_file) {
                coverImageId = await uploadFile(formData.cover_image_file, signal);
            }

            const bookData = {
                title: formData.title,
                isbn: formData.isbn,
                location: formData.location,
                is_reference_only: formData.is_reference_only,
                description: formData.description,
                published_date: formData.published_date || undefined,
                publisher_id: formData.publisher_id,
                language: formData.language,
                page_count: parseInt(formData.page_count.toString()) || 0,
                total_copies: parseInt(formData.total_copies.toString()) || 0,
                available_copies: parseInt(formData.available_copies.toString()) || 0,
                category_ids: formData.category_ids,
                author_ids: formData.author_ids,
                cover_image_id: coverImageId
            };

            const url = editingBook
                ? `${API_BASE_URL}/book/${editingBook.id}`
                : `${API_BASE_URL}/book`;

            const method = editingBook ? 'PUT' : 'POST';
            const body = bookData;

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to save book');
            }

            actionAbortController.current = null;
            handleCancelForm();
            fetchBooks();
            alert(`Book ${editingBook ? 'updated' : 'created'} successfully!`);
        } catch (error: any) {
            if (error.name === 'AbortError') {
                // Operation was cancelled, do nothing
                return;
            }
            console.error('Error saving book:', error);
            alert(`Failed to save book. ${error instanceof Error ? error.message : 'Please try again.'}`);
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
            const response = await fetch(`${API_BASE_URL}/book/${deleteModal.book.id}`, {
                method: 'DELETE',
                signal
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to delete book');
            }

            actionAbortController.current = null;
            setDeleteModal({ isOpen: false, book: null });
            fetchBooks();
            alert('Book deleted successfully!');
        } catch (error: any) {
            if (error.name === 'AbortError') {
                // Operation was cancelled, do nothing
                return;
            }
            console.error('Error deleting book:', error);
            alert(`Failed to delete book. ${error instanceof Error ? error.message : 'Please try again.'}`);
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
            publisher_id: '',
            language: '',
            page_count: 0,
            total_copies: 0,
            available_copies: 0,
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
                « Prev
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
                Next »
            </button>
        );

        return <div className="d-flex justify-content-center align-items-center mt-4">{pages}</div>;
    };

    if (showForm) {
        return (
            <div>
                <div className="card shadow-sm">
                    <div className="card-header bg-primary text-white">
                        <h5 className="mb-0">{editingBook ? 'Edit Book' : 'Add New Book'}</h5>
                    </div>
                    <div className="card-body">
                        {dataLoading && (
                            <div className="alert alert-info mb-3">
                                <div className="d-flex align-items-center gap-2">
                                    <div className="spinner-border spinner-border-sm"></div>
                                    <span>Loading form data...</span>
                                </div>
                            </div>
                        )}
                        {/* Cover Image Upload */}
                        <div className="mb-4">
                            <label className="form-label fw-semibold">Cover Image</label>
                            <div className="row">
                                <div className="col-md-8">
                                    <input
                                        type="file"
                                        className="form-control"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                    />
                                    <small className="text-muted">Upload a book cover image (JPG, PNG, max 5MB)</small>
                                </div>
                                <div className="col-md-4">
                                    {(imagePreview || editingBook?.cover_image_id?.url) && (
                                        <div className="text-center">
                                            <img
                                                src={imagePreview || editingBook?.cover_image_id?.url}
                                                alt="Cover preview"
                                                className="img-thumbnail"
                                                style={{ maxHeight: '150px', maxWidth: '100%', objectFit: 'cover' }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Basic Info */}
                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label className="form-label fw-semibold">Title *</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={formData.title}
                                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder="Enter book title"
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <label className="form-label fw-semibold">ISBN *</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={formData.isbn}
                                    onChange={(e) => setFormData(prev => ({ ...prev, isbn: e.target.value }))}
                                    placeholder="Enter ISBN number"
                                />
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label className="form-label fw-semibold">Location</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="e.g., Shelf A-12"
                                    value={formData.location}
                                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <label className="form-label fw-semibold">Language</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="e.g., eng, uzb, rus"
                                    value={formData.language}
                                    onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-4 mb-3">
                                <label className="form-label fw-semibold">Published Date</label>
                                <input
                                    type="date"
                                    className="form-control"
                                    value={formData.published_date}
                                    onChange={(e) => setFormData(prev => ({ ...prev, published_date: e.target.value }))}
                                />
                            </div>
                            <div className="col-md-4 mb-3">
                                <label className="form-label fw-semibold">Page Count</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    min="0"
                                    value={formData.page_count}
                                    onChange={(e) => setFormData(prev => ({ ...prev, page_count: parseInt(e.target.value) || 0 }))}
                                />
                            </div>
                            <div className="col-md-4 mb-3">
                                <SearchableSelect
                                    label="Publisher"
                                    options={publishers.map(pub => ({
                                        id: pub.id,
                                        label: pub.name,
                                        subtitle: pub.country
                                    }))}
                                    value={formData.publisher_id}
                                    onChange={(value) => setFormData(prev => ({ ...prev, publisher_id: value as string }))}
                                    placeholder="Search publisher..."
                                    multiple={false}
                                />
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-4 mb-3">
                                <label className="form-label fw-semibold">Total Copies</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    min="0"
                                    value={formData.total_copies}
                                    onChange={(e) => setFormData(prev => ({ ...prev, total_copies: parseInt(e.target.value) || 0 }))}
                                />
                            </div>
                            <div className="col-md-4 mb-3">
                                <label className="form-label fw-semibold">Available Copies</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    min="0"
                                    value={formData.available_copies}
                                    onChange={(e) => setFormData(prev => ({ ...prev, available_copies: parseInt(e.target.value) || 0 }))}
                                />
                            </div>
                            <div className="col-md-4 mb-3">
                                <label className="form-label fw-semibold d-block">Reference Only</label>
                                <div className="form-check mt-2">
                                    <input
                                        type="checkbox"
                                        className="form-check-input"
                                        id="referenceOnly"
                                        checked={formData.is_reference_only}
                                        onChange={(e) => setFormData(prev => ({ ...prev, is_reference_only: e.target.checked }))}
                                    />
                                    <label className="form-check-label" htmlFor="referenceOnly">
                                        Cannot be borrowed
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="mb-3">
                            <label className="form-label fw-semibold">Description</label>
                            <textarea
                                className="form-control"
                                rows={3}
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Enter book description"
                            />
                        </div>

                        {/* Authors Selection */}
                        <div className="mb-3">
                            <SearchableSelect
                                label="Authors"
                                options={authors.map(author => ({
                                    id: author.id,
                                    label: author.name,
                                    subtitle: author.bio ? author.bio.substring(0, 50) + '...' : undefined
                                }))}
                                value={formData.author_ids}
                                onChange={(value) => setFormData(prev => ({ ...prev, author_ids: value as string[] }))}
                                placeholder={authors.length === 0 ? "No authors available" : "Search and select authors..."}
                                multiple={true}
                                disabled={authors.length === 0}
                            />
                            {authors.length === 0 && (
                                <small className="text-muted">No authors available. Please add authors first.</small>
                            )}
                        </div>

                        {/* Categories Selection */}
                        <div className="mb-4">
                            <SearchableSelect
                                label="Categories"
                                options={categories.map(cat => ({
                                    id: cat.id,
                                    label: cat.name,
                                    subtitle: cat.description ? cat.description.substring(0, 50) + '...' : undefined
                                }))}
                                value={formData.category_ids}
                                onChange={(value) => setFormData(prev => ({ ...prev, category_ids: value as string[] }))}
                                placeholder={categories.length === 0 ? "No categories available" : "Search and select categories..."}
                                multiple={true}
                                disabled={categories.length === 0}
                            />
                            {categories.length === 0 && (
                                <small className="text-muted">No categories available. Please add categories first.</small>
                            )}
                        </div>

                        <div className="d-flex gap-2">
                            <button
                                className="btn btn-primary px-4"
                                onClick={handleSave}
                                disabled={actionLoading || !formData.title.trim() || !formData.isbn.trim()}
                            >
                                {actionLoading ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2"></span>
                                        {formData.cover_image_file ? 'Uploading & Saving...' : 'Saving...'}
                                    </>
                                ) : (
                                    editingBook ? 'Update Book' : 'Create Book'
                                )}
                            </button>
                            <button
                                type="button"
                                className="btn btn-outline-secondary px-4"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancelForm();
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div onClick={saveCurrentState}>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h3 className="mb-1">Books Management</h3>
                    <p className="text-muted mb-0">Manage library book inventory</p>
                </div>
                <button className="btn btn-primary d-flex align-items-center gap-2" onClick={() => setShowForm(true)}>
                    <span>+</span>
                    Add New Book
                </button>
            </div>

            {/* Search Card */}
            <div className="card mb-4 shadow-sm">
                <div className="card-header bg-light">
                    <h6 className="mb-0">Search Books</h6>
                </div>
                <div className="card-body">
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Search by title, ISBN, or author name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Error Alert */}
            {error && (
                <div className="alert alert-danger alert-dismissible" role="alert">
                    <strong>Error!</strong> {error}
                    <button type="button" className="btn-close" onClick={() => setError(null)}></button>
                </div>
            )}

            {/* Books Table */}
            <div className="card shadow-sm">
                <div className="card-header bg-white">
                    <div className="row align-items-center">
                        <div className="col">
                            <h6 className="mb-0">All Books</h6>
                        </div>
                        <div className="col-auto">
                            <div className="d-flex gap-4 small text-muted">
                                <span>Total: <strong>{totalBooks}</strong></span>
                                <span>Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong></span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="card-body p-0">
                    {loading ? (
                        <div className="text-center p-5">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                            <p className="mt-3 text-muted">Loading books...</p>
                        </div>
                    ) : books.length === 0 ? (
                        <div className="text-center p-5">
                            <div className="text-muted mb-3" style={{ fontSize: '3rem' }}>📚</div>
                            <h5>No Books Found</h5>
                            <p className="text-muted mb-4">
                                {searchQuery
                                    ? 'No books match your search query.'
                                    : 'No books have been added yet.'
                                }
                            </p>
                            {!searchQuery && (
                                <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                                    Add First Book
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th className="border-0 fw-semibold" style={{ width: '80px' }}>Cover</th>
                                        <th className="border-0 fw-semibold">Title</th>
                                        <th className="border-0 fw-semibold">Authors</th>
                                        <th className="border-0 fw-semibold">ISBN</th>
                                        <th className="border-0 fw-semibold">Location</th>
                                        <th className="border-0 fw-semibold">Copies</th>
                                        <th className="border-0 fw-semibold text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {books.map((book) => (
                                        <tr key={book.id}>
                                            <td className="py-3">
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
                                                        📖
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-3">
                                                <div className="fw-medium">{book.title}</div>
                                                {book.is_reference_only && (
                                                    <span className="badge bg-warning text-dark small mt-1">Reference Only</span>
                                                )}
                                            </td>
                                            <td className="py-3 text-muted small">
                                                {book.author_ids?.length > 0 ? book.author_ids?.map(a => a.name).join(', ') : '-'}
                                            </td>
                                            <td className="py-3 text-muted">{book.isbn}</td>
                                            <td className="py-3 text-muted">{book.location || '-'}</td>
                                            <td className="py-3">
                                                <span className={`badge ${book.available_copies > 0 ? 'bg-success' : 'bg-danger'}`}>
                                                    {book.available_copies}/{book.total_copies}
                                                </span>
                                            </td>
                                            <td className="py-3 text-end">
                                                <div className="btn-group btn-group-sm">
                                                    <button
                                                        className="btn btn-outline-primary"
                                                        onClick={() => {
                                                            setEditingBook(book);
                                                            setFormData({
                                                                title: book.title,
                                                                isbn: book.isbn,
                                                                location: book.location,
                                                                is_reference_only: book.is_reference_only,
                                                                description: book.description,
                                                                published_date: book.published_date ? book.published_date.split('T')[0] : '',
                                                                publisher_id: book.publisher_id?.id || '',
                                                                language: book.language,
                                                                page_count: book.page_count,
                                                                total_copies: book.total_copies,
                                                                available_copies: book.available_copies,
                                                                category_ids: book.category_ids?.map(c => c.id),
                                                                author_ids: book.author_ids?.map(a => a.id),
                                                                cover_image_file: null,
                                                                cover_image_id: book.cover_image_id?.id || ''
                                                            });
                                                            setImagePreview(book.cover_image_id?.url || null);
                                                            setShowForm(true);
                                                        }}
                                                        title="Edit book"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        className="btn btn-outline-danger"
                                                        onClick={() => setDeleteModal({ isOpen: true, book })}
                                                        title="Delete book"
                                                    >
                                                        Delete
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
                                <h5 className="modal-title text-danger">Confirm Delete</h5>
                                <button type="button" className="btn-close" onClick={() => setDeleteModal({ isOpen: false, book: null })}></button>
                            </div>
                            <div className="modal-body">
                                <div className="text-center mb-3">
                                    <div className="text-danger mb-3" style={{ fontSize: '3rem' }}>⚠️</div>
                                    <p className="mb-2">Are you sure you want to delete <strong>{deleteModal.book?.title}</strong>?</p>
                                    <p className="text-muted small">This action cannot be undone.</p>
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
                                    Cancel
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
                                            Deleting...
                                        </>
                                    ) : (
                                        'Delete'
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