import { usePaginatedList } from './usePaginatedList';
import { readAPI, staffFetch } from './api';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Book, Borrowing, User } from './types';
import { API_BASE_URL } from './types';
import SearchableSelectAsync from './SearchableSelectAsync';

interface BorrowingFormData {
  book_id: string;
  user_id: string;
  from_date: string;
  due_date: string;
  extension_date: string;
  returned_at: string;
  status: 'borrowed' | 'returned' | 'lost';
  notes: string;
}

interface SavedData {
  showForm?: boolean;
  formData?: BorrowingFormData;
  editingBorrowing?: Borrowing | null;
  searchQuery?: string;
  statusFilter?: string;
}

interface Props {
  savedData: SavedData | null;
  onDataChange: (data: SavedData | null) => void;
}

// Borrowings Section
const BorrowingsSection = ({ savedData, onDataChange }: Props) => {
  const [searchQuery, setSearchQuery] = useState(savedData?.searchQuery ?? '');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    book_id: '',
    user_id: '',
    from_date: '',
    due_date: '',
    notes: '',
    status: 'borrowed' as 'borrowed' | 'returned' | 'lost',
    returned_at: '',
    extension_date: ''
  });
  const [editingBorrowing, setEditingBorrowing] = useState<Borrowing | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; borrowing: Borrowing | null }>({ isOpen: false, borrowing: null });
  const [actionLoading, setActionLoading] = useState(false);
  const hasLoadedRef = useRef(false);
  const checkoutRequest = useRef<{ details: string; id: string } | null>(null);
  const actionAbortController = useRef<AbortController | null>(null);

  const {
    items: borrowings, total: totalBorrowings, loading, error, currentPage, setCurrentPage, reload: fetchBorrowings,
  } = usePaginatedList<Borrowing>('/borrowings', 'borrowings', 'total_count', searchQuery, new URLSearchParams({ status: statusFilter }).toString());
  const itemsPerPage = 20;

  useEffect(() => {
    return () => {
      if (actionAbortController.current) {
        actionAbortController.current.abort();
      }
    };
  }, []);

  const fetchBooks = useCallback(async (search: string, signal?: AbortSignal) => {
    const params = new URLSearchParams({ limit: '50', available_only: 'true', search });
    const { books = [] } = await readAPI<{ books?: Book[] }>(`/books?${params}`, { signal });
    return books.map(book => ({
      id: book.id,
      label: book.title,
      subtitle: `Available: ${book.available_copies} | ISBN: ${book.isbn}`,
    }));
  }, []);

  const fetchUsers = useCallback(async (search: string, signal?: AbortSignal) => {
    const params = new URLSearchParams({ limit: '50', search });
    const { users = [] } = await readAPI<{ users?: User[] }>(`/users?${params}`, { signal });
    return users.map(user => ({
      id: user.id,
      label: user.full_name,
      subtitle: [user.role, user.group_name, user.email].filter(Boolean).join(' | '),
    }));
  }, []);

  useEffect(() => {
    if (savedData && !hasLoadedRef.current) {
      if (savedData.showForm) setShowForm(true);
      if (savedData.formData) setFormData(savedData.formData);
      if (savedData.editingBorrowing) setEditingBorrowing(savedData.editingBorrowing);
      if (savedData.searchQuery) setSearchQuery(savedData.searchQuery);
      if (savedData.statusFilter) setStatusFilter(savedData.statusFilter);
      hasLoadedRef.current = true;
    }
  }, [savedData]);



  const handleSave = async () => {
    if (!formData.book_id || !formData.user_id || !formData.from_date || !formData.due_date) {
      alert('Book, User, From Date, and Due Date are required');
      return;
    }

    setActionLoading(true);
    actionAbortController.current = new AbortController();
    const signal = actionAbortController.current.signal;
    try {
      const body = editingBorrowing ? {
        from_date: formData.from_date,
        due_date: formData.due_date,
        extension_date: formData.extension_date || undefined,
        status: formData.status,
        returned_at: formData.status === 'returned' ? formData.returned_at || undefined : undefined,
        notes: formData.notes,
      } : {
        book_id: formData.book_id,
        user_id: formData.user_id,
        from_date: formData.from_date,
        due_date: formData.due_date,
        notes: formData.notes,
      };
      const details = JSON.stringify(body);
      if (!editingBorrowing && checkoutRequest.current?.details !== details) {
        checkoutRequest.current = { details, id: crypto.randomUUID() };
      }
      await readAPI(editingBorrowing ? `/borrowing/${editingBorrowing.id}` : '/borrowing', {
        method: editingBorrowing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, request_id: editingBorrowing ? undefined : checkoutRequest.current?.id }),
        signal,
      });

      actionAbortController.current = null;
      handleCancelForm();
      fetchBorrowings();
      alert(`Borrowing ${editingBorrowing ? 'updated' : 'created'} successfully!`);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      alert(error instanceof Error ? error.message : 'Failed to save borrowing.');
    } finally {
      setActionLoading(false);
    }
  };

  const updateLoanStatus = async (loan: Borrowing, action: 'return' | 'lost') => {
    const instruction = action === 'return' ? 'Return this copy?' : 'Mark this copy as lost?';
    if (!window.confirm(instruction)) return;
    setActionLoading(true);
    try {
      await readAPI(`/borrowing/${loan.id}/${action}`, { method: 'POST' });
      fetchBorrowings();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not update loan status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.borrowing) return;

    setActionLoading(true);
    actionAbortController.current = new AbortController();
    const signal = actionAbortController.current.signal;
    try {
      const response = await staffFetch(`${API_BASE_URL}/borrowing/${deleteModal.borrowing.id}`, {
        method: 'DELETE',
        signal
      });

      if (!response.ok) throw new Error('Failed to delete borrowing');

      actionAbortController.current = null;
      setDeleteModal({ isOpen: false, borrowing: null });
      fetchBorrowings();
      alert('Borrowing deleted successfully!');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      alert('Failed to delete borrowing. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelForm = () => {
    if (actionAbortController.current) {
      actionAbortController.current.abort();
      actionAbortController.current = null;
    }
    checkoutRequest.current = null;
    setActionLoading(false);
    setShowForm(false);
    setEditingBorrowing(null);
    setFormData({
      book_id: '',
      user_id: '',
      from_date: '',
      due_date: '',
      notes: '',
      status: 'borrowed',
      returned_at: '',
      extension_date: ''
    });
    onDataChange(null);
  };


  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'borrowed': return 'bg-primary';
      case 'returned': return 'bg-success';
      case 'lost': return 'bg-danger';
      default: return 'bg-secondary';
    }
  };

  if (showForm) {
    return (
      <div>
        <div className="card shadow-sm">
          <div className="card-header bg-primary text-white">
            <h5 className="mb-0">{editingBorrowing ? 'Edit Borrowing' : 'New Borrowing'}</h5>
          </div>
          <div className="card-body">
            {!editingBorrowing && (
              <>
                <div className="mb-3">
                  <SearchableSelectAsync
                    label="Book"
                    required
                    fetchOptions={fetchBooks}
                    value={formData.book_id}
                    onChange={(value) => setFormData(prev => ({ ...prev, book_id: value as string }))}
                    placeholder="Type to search books..."
                    multiple={false}
                  />
                </div>

                <div className="mb-3">
                  <SearchableSelectAsync
                    label="User"
                    required
                    fetchOptions={fetchUsers}
                    value={formData.user_id}
                    onChange={(value) => setFormData(prev => ({ ...prev, user_id: value as string }))}
                    placeholder="Type to search users..."
                    multiple={false}
                  />
                </div>
              </>
            )}

            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label fw-semibold">From Date *</label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.from_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, from_date: e.target.value }))}
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label fw-semibold">Due Date *</label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.due_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                />
              </div>
            </div>

            {editingBorrowing && (
              <>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-semibold">Status</label>
                    <select
                      className="form-select"
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as BorrowingFormData["status"] }))}
                    >
                      <option value="borrowed" disabled={editingBorrowing?.status !== 'borrowed'}>Borrowed</option>
                      <option value="returned">Returned</option>
                      <option value="lost" disabled={editingBorrowing?.status === 'returned'}>Lost</option>
                    </select>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-semibold">Extension Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.extension_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, extension_date: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Returned At</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.returned_at}
                    onChange={(e) => setFormData(prev => ({ ...prev, returned_at: e.target.value }))}
                  />
                </div>
              </>
            )}

            <div className="mb-4">
              <label className="form-label fw-semibold">Notes</label>
              <textarea
                className="form-control"
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>

            <div className="d-flex gap-2">
              <button 
                className="btn btn-primary px-4" 
                onClick={handleSave}
                disabled={actionLoading}
              >
                {actionLoading ? 'Saving...' : (editingBorrowing ? 'Update' : 'Create')}
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
          <h3 className="mb-1">Borrowings Management</h3>
          <p className="text-muted mb-0">Track book loans and returns</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + New Borrowing
        </button>
      </div>

      <div className="card mb-4 shadow-sm">
        <div className="card-body">
          <div className="row">
            <div className="col-md-8">
              <input
                type="text"
                className="form-control"
                placeholder="Search borrowings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <select
                className="form-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="borrowed">Borrowed</option>
                <option value="returned">Returned</option>
                <option value="lost">Lost</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-header bg-white">
          <span className="small text-muted">Total: <strong>{totalBorrowings}</strong></span>
        </div>
        <div className="card-body p-0">
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          {loading ? (
            <div className="text-center p-5">
              <div className="spinner-border text-primary"></div>
            </div>
          ) : borrowings.length === 0 ? (
            <div className="text-center p-5">
              <p className="mb-0">No borrowings found</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0 library-record-table" role="table">
                <thead role="rowgroup" className="table-light">
                  <tr role="row">
                    <th role="columnheader" scope="col">Book</th>
                    <th role="columnheader" scope="col">Borrower</th>
                    <th role="columnheader" scope="col">From Date</th>
                    <th role="columnheader" scope="col">Due Date</th>
                    <th role="columnheader" scope="col">Status</th>
                    <th role="columnheader" scope="col" className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody role="rowgroup">
                  {borrowings.map((borrowing) => (
                    <tr role="row" key={borrowing.id}>
                      <td role="cell" data-label="Book" className="fw-medium">{borrowing.book.title}</td>
                      <td role="cell" data-label="Borrower">
                        <div>{borrowing.user.full_name}</div>
                        <small className="text-muted">{borrowing.user.role}</small>
                      </td>
                      <td role="cell" data-label="From date">{new Date(borrowing.from_date).toLocaleDateString()}</td>
                      <td role="cell" data-label="Due date">{new Date(borrowing.due_date).toLocaleDateString()}</td>
                      <td role="cell" data-label="Status">
                        <span className={`badge ${getStatusBadgeClass(borrowing.status)}`}>
                          {borrowing.status}
                        </span>
                      </td>
                      <td role="cell" data-label="Actions" className="text-end">
                        <div className="btn-group btn-group-sm">
                          <button
                            className="btn btn-outline-primary"
                            onClick={() => {
                              setEditingBorrowing(borrowing);
                              setFormData({
                                book_id: borrowing.book.id,
                                user_id: borrowing.user.id,
                                from_date: borrowing.from_date.split('T')[0],
                                due_date: borrowing.due_date.split('T')[0],
                                extension_date: borrowing.extension_date ? borrowing.extension_date.split('T')[0] : '',
                                status: borrowing.status,
                                returned_at: borrowing.returned_at ? borrowing.returned_at.split('T')[0] : '',
                                notes: borrowing.notes ?? ''
                              });
                              setShowForm(true);
                            }}
                          >
                            Edit
                          </button>
                          {borrowing.status !== 'returned' && (
                            <button className="btn btn-outline-success" disabled={actionLoading} onClick={() => void updateLoanStatus(borrowing, 'return')}>
                              Return
                            </button>
                          )}
                          {borrowing.status === 'borrowed' && (
                            <button className="btn btn-outline-warning" disabled={actionLoading} onClick={() => void updateLoanStatus(borrowing, 'lost')}>
                              Mark lost
                            </button>
                          )}
                          {borrowing.status === 'returned' && (
                            <button className="btn btn-outline-danger" onClick={() => setDeleteModal({ isOpen: true, borrowing })}>
                              Delete
                            </button>
                          )}
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

      {!showForm && totalBorrowings > itemsPerPage && (
        <nav className="d-flex align-items-center justify-content-center gap-3 mt-3" aria-label="Loan pages">
          <button className="btn btn-outline-primary btn-sm" disabled={currentPage === 1}
            onClick={() => setCurrentPage(page => page - 1)}>Previous</button>
          <span>Page {currentPage} of {Math.ceil(totalBorrowings / itemsPerPage)}</span>
          <button className="btn btn-outline-primary btn-sm" disabled={currentPage >= Math.ceil(totalBorrowings / itemsPerPage)}
            onClick={() => setCurrentPage(page => page + 1)}>Next</button>
        </nav>
      )}

      {deleteModal.isOpen && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Confirm Delete</h5>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to delete this borrowing record?</p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setDeleteModal({ isOpen: false, borrowing: null })} disabled={actionLoading}>
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

export default BorrowingsSection;