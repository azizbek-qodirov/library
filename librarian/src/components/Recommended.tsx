import { useCallback, useEffect, useRef, useState } from 'react';
import type { Book, Recommended } from './types';
import { API_BASE_URL } from './types';
import SearchableSelectAsync from './SearchableSelectAsync';

interface SavedData {
  showForm?: boolean;
  selectedBookId?: string;
  searchQuery?: string;
}

interface Props {
  savedData: SavedData | null;
  onDataChange: (data: SavedData | null) => void;
}

// Recommended Section
const RecommendedSection = ({ savedData, onDataChange }: Props) => {
  const [recommended, setRecommended] = useState<Recommended[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecommended, setTotalRecommended] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; recommended: Recommended | null }>({ isOpen: false, recommended: null });
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actionAbortController = useRef<AbortController | null>(null);
  const hasLoadedRef = useRef(false);

  const itemsPerPage = 20;
  const totalPages = Math.ceil(totalRecommended / itemsPerPage);

  useEffect(() => {
    return () => {
      if (actionAbortController.current) {
        actionAbortController.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (savedData && !hasLoadedRef.current) {
      if (savedData.showForm) setShowForm(true);
      if (savedData.selectedBookId) setSelectedBookId(savedData.selectedBookId);
      if (savedData.searchQuery) setSearchQuery(savedData.searchQuery);
      hasLoadedRef.current = true;
    }
  }, [savedData]);

  const fetchBooks = useCallback(async (searchQuery: string = '') => {
    try {
      const params = new URLSearchParams();
      params.append('limit', '100');
      params.append('offset', '0');
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }
      const response = await fetch(`${API_BASE_URL}/books?${params.toString()}`);
      const data = await response.json();
      const books = data.books || [];

      return books.map((book: Book) => ({
        id: book.id,
        label: book.title,
        subtitle: `${book.author_ids?.map(a => a.name).join(', ') || 'No author'} | ISBN: ${book.isbn}`
      }));
    } catch (error) {
      console.error('Error fetching books:', error);
      return [];
    }
  }, []);

  const fetchRecommended = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('limit', itemsPerPage.toString());
      params.append('offset', ((currentPage - 1) * itemsPerPage).toString());
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      const response = await fetch(`${API_BASE_URL}/recommended?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch recommended books');

      const data = await response.json();
      setRecommended(data.recommendeds || []);
      setTotalRecommended(data.total_count || 0);
    } catch (error) {
      console.error('Error fetching recommended:', error);
      setError('Failed to fetch recommended books. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, itemsPerPage]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchRecommended();
    }, 1000);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchRecommended]);

  useEffect(() => {
    fetchRecommended();
  }, [currentPage, fetchRecommended]);

  const handleSave = async () => {
    if (!selectedBookId) {
      alert('Please select a book');
      return;
    }

    // Check if book is already recommended
    const alreadyRecommended = recommended.some(rec => rec.book_id.id === selectedBookId);
    if (alreadyRecommended) {
      alert('This book is already in the recommended list!');
      return;
    }

    setActionLoading(true);
    actionAbortController.current = new AbortController();
    const signal = actionAbortController.current.signal;
    try {
      const response = await fetch(`${API_BASE_URL}/recommended`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: selectedBookId }),
        signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to add recommended book');
      }

      actionAbortController.current = null;
      handleCancelForm();
      fetchRecommended();
      alert('Book added to recommended successfully!');
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      console.error('Error adding recommended:', error);
      alert(`Failed to add recommended book. ${error.message || 'Please try again.'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.recommended) return;

    setActionLoading(true);
    actionAbortController.current = new AbortController();
    const signal = actionAbortController.current.signal;
    try {
      const response = await fetch(`${API_BASE_URL}/recommended/${deleteModal.recommended.id}`, {
        method: 'DELETE',
        signal
      });

      if (!response.ok) throw new Error('Failed to remove recommended book');

      actionAbortController.current = null;
      setDeleteModal({ isOpen: false, recommended: null });
      fetchRecommended();
      alert('Recommended book removed successfully!');
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      alert('Failed to remove recommended book. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelForm = () => {
    if (actionAbortController.current) {
      actionAbortController.current.abort();
      actionAbortController.current = null;
    }
    setActionLoading(false);
    setShowForm(false);
    setSelectedBookId('');
    onDataChange(null);
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
            <h5 className="mb-0">Add Recommended Book</h5>
          </div>
          <div className="card-body">
            <div className="mb-4">
              <SearchableSelectAsync
                label="Select Book"
                required
                fetchOptions={fetchBooks}
                value={selectedBookId}
                onChange={(value) => setSelectedBookId(value as string)}
                placeholder="Type to search books..."
                multiple={false}
              />
              <small className="text-muted">
                Search by title, author, or ISBN. Only books not already recommended will be added.
              </small>
            </div>

            <div className="d-flex gap-2">
              <button
                className="btn btn-primary px-4"
                onClick={handleSave}
                disabled={actionLoading || !selectedBookId}
              >
                {actionLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Adding...
                  </>
                ) : (
                  'Add to Recommended'
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
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-1">Recommended Books</h3>
          <p className="text-muted mb-0">Feature books on the homepage</p>
        </div>
        <button className="btn btn-primary d-flex align-items-center gap-2" onClick={() => setShowForm(true)}>
          <span>+</span>
          Add Recommended Book
        </button>
      </div>

      {/* Search Card */}
      <div className="card mb-4 shadow-sm">
        <div className="card-header bg-light">
          <h6 className="mb-0">Search Recommended Books</h6>
        </div>
        <div className="card-body">
          <input
            type="text"
            className="form-control"
            placeholder="Search by book title, author, or ISBN..."
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

      {/* Recommended Books Grid */}
      <div className="card shadow-sm">
        <div className="card-header bg-white">
          <div className="row align-items-center">
            <div className="col">
              <h6 className="mb-0">All Recommended Books</h6>
            </div>
            <div className="col-auto">
              <div className="d-flex gap-4 small text-muted">
                <span>Total: <strong>{totalRecommended}</strong></span>
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
              <p className="mt-3 text-muted">Loading recommended books...</p>
            </div>
          ) : recommended.length === 0 ? (
            <div className="text-center p-5">
              <div className="text-muted mb-3" style={{ fontSize: '3rem' }}>⭐</div>
              <h5>No Recommended Books</h5>
              <p className="text-muted mb-4">
                {searchQuery
                  ? 'No books match your search query.'
                  : 'No books have been recommended yet.'
                }
              </p>
              {!searchQuery && (
                <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                  Add First Recommended Book
                </button>
              )}
            </div>
          ) : (
            <div className="row g-4 p-4">
              {recommended.map((rec) => (
                <div key={rec.id} className="col-md-4 col-lg-3">
                  <div className="card h-100 shadow-sm border-0">
                    {rec.book_id.cover_image_id?.url ? (
                      <img
                        src={rec.book_id.cover_image_id.url}
                        className="card-img-top"
                        alt={rec.book_id.title}
                        style={{ height: '280px', objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        className="card-img-top bg-light d-flex align-items-center justify-content-center"
                        style={{ height: '280px', fontSize: '4rem' }}
                      >
                        📚
                      </div>
                    )}
                    <div className="card-body">
                      <h6 className="card-title fw-bold mb-2">{rec.book_id.title}</h6>
                      <p className="card-text text-muted small mb-2">
                        <strong>By:</strong> {rec.book_id.author_ids?.map(a => a.name).join(', ') || 'Unknown'}
                      </p>
                      <p className="card-text text-muted small mb-3">
                        <strong>ISBN:</strong> {rec.book_id.isbn}
                      </p>
                      <div className="d-flex justify-content-between align-items-center">
                        <small className="text-muted">
                          Added {new Date(rec.created_at).toLocaleDateString()}
                        </small>
                      </div>
                    </div>
                    <div className="card-footer bg-white border-0">
                      <button
                        className="btn btn-sm btn-outline-danger w-100"
                        onClick={() => setDeleteModal({ isOpen: true, recommended: rec })}
                      >
                        Remove from Recommended
                      </button>
                    </div>
                  </div>
                </div>
              ))}
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
                <h5 className="modal-title text-danger">Confirm Remove</h5>
                <button type="button" className="btn-close" onClick={() => setDeleteModal({ isOpen: false, recommended: null })}></button>
              </div>
              <div className="modal-body">
                <div className="text-center mb-3">
                  <div className="text-warning mb-3" style={{ fontSize: '3rem' }}>⚠️</div>
                  <p className="mb-2">
                    Remove <strong>{deleteModal.recommended?.book_id.title}</strong> from recommended books?
                  </p>
                  <p className="text-muted small">This will no longer feature on the homepage.</p>
                </div>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setDeleteModal({ isOpen: false, recommended: null })}
                  disabled={actionLoading}
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
                      Removing...
                    </>
                  ) : (
                    'Remove'
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

export default RecommendedSection;
