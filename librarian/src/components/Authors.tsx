import { type JSX, useCallback, useEffect, useRef, useState } from 'react';
import type { Author } from './types';
import { API_BASE_URL } from './types';

interface SavedData {
  showForm?: boolean;
  formData?: { name: string; birth_date: string; biography: string };
  editingAuthor?: Author | null;
  searchQuery?: string;
}

interface Props {
  savedData: SavedData | null;
  onDataChange: (data: SavedData | null) => void;
}

// Authors Section Component (Similar structure)
const AuthorsSection = ({ savedData, onDataChange }: Props) => {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalAuthors, setTotalAuthors] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', birth_date: '', biography: '' });
  const [editingAuthor, setEditingAuthor] = useState<Author | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; author: Author | null }>({ isOpen: false, author: null });
  const [actionLoading, setActionLoading] = useState(false);
  const actionAbortController = useRef<AbortController | null>(null);

  const itemsPerPage = 20;
  const totalPages = Math.ceil(totalAuthors / itemsPerPage);

  useEffect(() => {
    return () => {
      if (actionAbortController.current) {
        actionAbortController.current.abort();
      }
    };
  }, []);

  const fetchAuthors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', itemsPerPage.toString());
      params.append('offset', ((currentPage - 1) * itemsPerPage).toString());
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const response = await fetch(`${API_BASE_URL}/authors?${params.toString()}`);
      const data = await response.json();
      setAuthors(data.authors || []);
      setTotalAuthors(data.total_count || 0);
    } catch (error) {
      console.error('Error fetching authors:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, itemsPerPage]);

  useEffect(() => {
    if (savedData) {
      if (savedData.showForm) setShowForm(true);
      if (savedData.formData) setFormData(savedData.formData);
      if (savedData.editingAuthor) setEditingAuthor(savedData.editingAuthor);
      if (savedData.searchQuery) setSearchQuery(savedData.searchQuery);
    }
  }, [savedData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchAuthors();
    }, 1000);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchAuthors]);

  useEffect(() => {
    fetchAuthors();
  }, [currentPage, fetchAuthors]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Author name is required');
      return;
    }

    actionAbortController.current = new AbortController();
    const signal = actionAbortController.current.signal;

    setActionLoading(true);
    try {
      const url = editingAuthor
        ? `${API_BASE_URL}/author/${editingAuthor.id}`
        : `${API_BASE_URL}/author`;

      const method = editingAuthor ? 'PUT' : 'POST';
      const body =  formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal
      });

      if (!response.ok) throw new Error('Failed to save author');

      actionAbortController.current = null;
      handleCancelForm();
      fetchAuthors();
      alert(`Author ${editingAuthor ? 'updated' : 'created'} successfully!`);
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      alert('Failed to save author. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.author) return;

    actionAbortController.current = new AbortController();
    const signal = actionAbortController.current.signal;

    setActionLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/author/${deleteModal.author.id}`, {
        method: 'DELETE',
        signal
      });

      if (!response.ok) throw new Error('Failed to delete author');

      actionAbortController.current = null;
      setDeleteModal({ isOpen: false, author: null });
      fetchAuthors();
      alert('Author deleted successfully!');
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      alert('Failed to delete author. Please try again.');
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
    setEditingAuthor(null);
    setFormData({ name: '', birth_date: '', biography: '' });
    onDataChange(null);
  };

  const saveCurrentState = () => {
    if (showForm || searchQuery) {
      onDataChange({
        showForm,
        formData,
        editingAuthor,
        searchQuery
      });
    }
  };

  // Pagination renderer — same behavior / style as UsersSection
  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages: JSX.Element[] = [];
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
      <div onClick={saveCurrentState}>
        <div className="card shadow-sm">
          <div className="card-header bg-primary text-white">
            <h5 className="mb-0">{editingAuthor ? 'Edit Author' : 'Add New Author'}</h5>
          </div>
          <div className="card-body">
            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label fw-semibold">Author Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label fw-semibold">Birth Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.birth_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, birth_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="form-label fw-semibold">Biography</label>
              <textarea
                className="form-control"
                rows={5}
                value={formData.biography}
                onChange={(e) => setFormData(prev => ({ ...prev, biography: e.target.value }))}
              />
            </div>
            <div className="d-flex gap-2">
              <button 
                className="btn btn-primary px-4" 
                onClick={handleSave}
                disabled={actionLoading}
              >
                {actionLoading ? 'Saving...' : (editingAuthor ? 'Update' : 'Create')}
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
          <h3 className="mb-1">Authors Management</h3>
          <p className="text-muted mb-0">Manage book authors</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Add New Author
        </button>
      </div>

      <div className="card mb-4 shadow-sm">
        <div className="card-body">
          <input
            type="text"
            className="form-control"
            placeholder="Search authors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-header bg-white">
          <div className="row align-items-center">
            <div className="col"><h6 className="mb-0">All Authors</h6></div>
            <div className="col-auto">
              <div className="d-flex gap-4 small text-muted">
                <span>Total: <strong>{totalAuthors}</strong></span>
                <span>Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong></span>
              </div>
            </div>
          </div>
        </div>
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center p-5">
              <div className="spinner-border text-primary"></div>
            </div>
          ) : authors.length === 0 ? (
            <div className="text-center p-5">
              <p className="mb-0">No authors found</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Name</th>
                    <th>Birth Date</th>
                    <th>Biography</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {authors.map((author) => (
                    <tr key={author.id}>
                      <td className="fw-medium">{author.name}</td>
                      <td>{author.birth_date ? new Date(author.birth_date).toLocaleDateString() : '-'}</td>
                      <td className="text-muted">{author.biography?.substring(0, 50)}{author.biography?.length > 50 ? '...' : ''}</td>
                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          <button
                            className="btn btn-outline-primary"
                            onClick={() => {
                              setEditingAuthor(author);
                              setFormData({ 
                                name: author.name, 
                                birth_date: author.birth_date || '', 
                                biography: author.biography 
                              });
                              setShowForm(true);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-outline-danger"
                            onClick={() => setDeleteModal({ isOpen: true, author })}
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

      {deleteModal.isOpen && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Confirm Delete</h5>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to delete <strong>{deleteModal.author?.name}</strong>?</p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setDeleteModal({ isOpen: false, author: null })} disabled={actionLoading}>
                  Cancel
                </button>
                <button className="btn btn-danger" onClick={handleDelete} disabled={actionLoading}>
                  {actionLoading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthorsSection;
