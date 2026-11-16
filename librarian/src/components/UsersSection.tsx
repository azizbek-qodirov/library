import { usePaginatedList } from './usePaginatedList';
import { staffFetch } from './api';

import { useEffect, useState, useRef } from 'react';
import DeleteConfirmationModal from './DeleteConfirmation';
import type { User, UserFormData } from './types';
import { API_BASE_URL } from './types';
import UserForm from './UserForm';

// Users Section Component
interface SavedData {
  showForm?: boolean;
  editingUser?: User | null;
  searchQuery?: string;
  roleFilter?: string;
  groupFilter?: string;
}

const UsersSection = ({ savedData, onDataChange }: {
  savedData?: SavedData | null;
  onDataChange: (data: SavedData | null) => void;
}) => {
  const [searchQuery, setSearchQuery] = useState(savedData?.searchQuery ?? '');
  const [roleFilter, setRoleFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; user: User | null }>({ isOpen: false, user: null });
  const [actionLoading, setActionLoading] = useState(false);
  const actionAbortController = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (actionAbortController.current) {
        actionAbortController.current.abort();
      }
    };
  }, []);


  const usersPerPage = 20;
  const {
    items: users, total: totalUsers, loading, error, currentPage, setCurrentPage, reload: fetchUsers,
  } = usePaginatedList<User>('/users', 'users', 'total', searchQuery,
    new URLSearchParams({ role: roleFilter, group_name: groupFilter.trim() }).toString(), usersPerPage);
  const totalPages = Math.ceil(totalUsers / usersPerPage);

  // Restore saved data
  useEffect(() => {
    if (savedData) {
      if (savedData.showForm) setShowForm(true);
      if (savedData.editingUser) setEditingUser(savedData.editingUser);
      if (savedData.searchQuery) setSearchQuery(savedData.searchQuery);
      if (savedData.roleFilter) setRoleFilter(savedData.roleFilter);
      if (savedData.groupFilter) setGroupFilter(savedData.groupFilter);
    }
  }, [savedData]);


  const handleSaveUser = async (formData: UserFormData) => {
    // Create new AbortController for this operation
    actionAbortController.current = new AbortController();
    const signal = actionAbortController.current.signal;

    setActionLoading(true);
    try {
      const url = editingUser
        ? `${API_BASE_URL}/user/${editingUser.id}`
        : `${API_BASE_URL}/user`;

      const method = editingUser ? 'PUT' : 'POST';
      const body = formData;

      const response = await staffFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Failed to ${editingUser ? 'update' : 'create'} user`);
      }

      actionAbortController.current = null;
      setShowForm(false);
      setEditingUser(null);
      onDataChange(null);
      fetchUsers();
      alert(`User ${editingUser ? 'updated' : 'created'} successfully!`);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Operation was cancelled, do nothing
        return;
      }
      console.error('Error saving user:', error);
      alert(`Failed to ${editingUser ? 'update' : 'create'} user. ${error instanceof Error ? error.message : 'Please try again.'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteModal.user) return;

    // Create new AbortController for this operation
    actionAbortController.current = new AbortController();
    const signal = actionAbortController.current.signal;

    setActionLoading(true);
    try {
      const response = await staffFetch(`${API_BASE_URL}/user/${deleteModal.user.id}`, {
        method: 'DELETE',
        signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to delete user');
      }

      actionAbortController.current = null;
      setDeleteModal({ isOpen: false, user: null });
      fetchUsers();
      alert('User deleted successfully!');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Operation was cancelled, do nothing
        return;
      }
      console.error('Error deleting user:', error);
      alert(`Failed to delete user. ${error instanceof Error ? error.message : 'Please try again.'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = () => {
    // Abort any ongoing operation
    if (actionAbortController.current) {
      actionAbortController.current.abort();
      actionAbortController.current = null;
    }
    setActionLoading(false);
    setShowForm(false);
    setEditingUser(null);
    onDataChange(null);
  };

  // Save current state when changing sections
  const saveCurrentState = () => {
    if (showForm || editingUser || searchQuery || roleFilter || groupFilter) {
      onDataChange({
        showForm,
        editingUser,
        searchQuery,
        roleFilter,
        groupFilter
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

    return <div className="d-flex flex-wrap row-gap-2 justify-content-center align-items-center mt-4">{pages}</div>;
  };

  if (showForm) {
    return (
      <div onClick={saveCurrentState}>
        <UserForm
          user={editingUser || undefined}
          onSave={handleSaveUser}
          onCancel={handleCancel}
          isLoading={actionLoading}
        />
      </div>
    );
  }

  return (
    <div onClick={saveCurrentState}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-1">Users Management</h3>
          <p className="text-muted mb-0">Manage student and teacher accounts</p>
        </div>
        <button className="btn btn-primary d-flex align-items-center gap-2" onClick={() => setShowForm(true)}>
          <span>+</span>
          Add New User
        </button>
      </div>

      {/* Filters Card */}
      <div className="card mb-4 shadow-sm">
        <div className="card-header bg-light">
          <h6 className="mb-0">Search & Filter</h6>
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label small fw-semibold">Search Users</label>
              <input
                type="text"
                className="form-control"
                placeholder="Search by name, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label small fw-semibold">Role</label>
              <select
                className="form-select"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="">All Roles</option>
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label small fw-semibold">Group</label>
              <input
                type="text"
                className="form-control"
                placeholder="Filter by group name..."
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert alert-danger alert-dismissible" role="alert">
          <strong>Error!</strong> {error}
        </div>
      )}

      {/* Users Table Card */}
      <div className="card shadow-sm">
        <div className="card-header bg-white">
          <div className="row align-items-center">
            <div className="col">
              <h6 className="mb-0">All Users</h6>
            </div>
            <div className="col-auto">
              <div className="d-flex gap-4 small text-muted">
                <span>Total: <strong>{totalUsers}</strong></span>
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
              <p className="mt-3 text-muted">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center p-5">
              <div className="text-muted mb-3" style={{ fontSize: '3rem' }}>👥</div>
              <h5>No Users Found</h5>
              <p className="text-muted mb-4">
                {searchQuery || roleFilter || groupFilter
                  ? 'No users match your current filters.'
                  : 'No users have been added yet.'
                }
              </p>
              {!searchQuery && !roleFilter && !groupFilter && (
                <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                  Add First User
                </button>
              )}
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0 library-record-table" role="table">
                <thead role="rowgroup" className="table-light">
                  <tr role="row">
                    <th role="columnheader" scope="col" className="border-0 fw-semibold">Name</th>
                    <th role="columnheader" scope="col" className="border-0 fw-semibold">Group</th>
                    <th role="columnheader" scope="col" className="border-0 fw-semibold">Email</th>
                    <th role="columnheader" scope="col" className="border-0 fw-semibold">Phone</th>
                    <th role="columnheader" scope="col" className="border-0 fw-semibold">Role</th>
                    <th role="columnheader" scope="col" className="border-0 fw-semibold">Created</th>
                    <th role="columnheader" scope="col" className="border-0 fw-semibold text-end">Actions</th>
                  </tr>
                </thead>
                <tbody role="rowgroup">
                  {users.map((user, index) => (
                    <tr role="row" key={user.id} style={{ borderLeft: index % 2 === 0 ? '3px solid transparent' : '3px solid #f8f9fa' }}>
                      <td role="cell" data-label="Name" className="py-3">
                        <div className="fw-medium">{user.full_name}</div>
                      </td>
                      <td role="cell" data-label="Group" className="py-3">
                        <span className="badge bg-light text-dark">
                          {user.group_name || 'No Group'}
                        </span>
                      </td>
                      <td role="cell" data-label="Email" className="py-3 text-muted">{user.email || '-'}</td>
                      <td role="cell" data-label="Phone" className="py-3 text-muted">{user.phone || '-'}</td>
                      <td role="cell" data-label="Role" className="py-3">
                        <span className={`badge ${user.role === 'teacher' ? 'bg-primary' : 'bg-secondary'}`}>
                          {user.role}
                        </span>
                      </td>
                      <td role="cell" data-label="Created" className="py-3 text-muted small">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td role="cell" data-label="Actions" className="py-3 text-end">
                        <div className="btn-group btn-group-sm">
                          <button
                            className="btn btn-outline-primary"
                            onClick={() => {
                              setEditingUser(user);
                              setShowForm(true);
                            }}
                            title="Edit user"
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-outline-danger"
                            onClick={() => setDeleteModal({ isOpen: true, user })}
                            title="Delete user"
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

      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        onConfirm={handleDeleteUser}
        onCancel={() => setDeleteModal({ isOpen: false, user: null })}
        itemName={deleteModal.user?.full_name || ''}
        isLoading={actionLoading}
      />
    </div>
  );
};

export default UsersSection;