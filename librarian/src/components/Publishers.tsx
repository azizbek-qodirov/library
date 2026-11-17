import { useI18n } from '../../../shared/i18n';
import { Icon } from '../../../shared/Icon';
import { usePaginatedList } from './usePaginatedList';
import { staffFetch } from './api';
import React, { useEffect, useRef, useState } from 'react';

import type { Publisher, PublisherFormData } from './types';
import { API_BASE_URL } from './types';

interface SavedData {
  showForm?: boolean;
  formData?: PublisherFormData;
  editingPublisher?: Publisher | null;
  searchQuery?: string;
}

interface Props {
  savedData?: SavedData | null;
  onDataChange: (data: SavedData | null) => void;
}


const PublishersSection: React.FC<Props> = ({ savedData, onDataChange }) => {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState(savedData?.searchQuery ?? '');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<PublisherFormData>({
    name: '',
    description: ''
  });
  const [editingPublisher, setEditingPublisher] = useState<Publisher | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; publisher: Publisher | null }>({
    isOpen: false,
    publisher: null
  });
  const [actionLoading, setActionLoading] = useState(false);
  const actionAbortController = useRef<AbortController | null>(null);

  const itemsPerPage = 20;
  const {
    items: publishers, total: totalPublishers, loading, error, currentPage, setCurrentPage, reload: fetchPublishers,
  } = usePaginatedList<Publisher>('/publishers', 'publishers', 'total_count', searchQuery);
  const totalPages = Math.ceil(totalPublishers / itemsPerPage);

  useEffect(() => {
    return () => {
      if (actionAbortController.current) {
        actionAbortController.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (savedData) {
      if (savedData.showForm) setShowForm(true);
      if (savedData.formData) setFormData(savedData.formData);
      if (savedData.editingPublisher) setEditingPublisher(savedData.editingPublisher);
      if (savedData.searchQuery) setSearchQuery(savedData.searchQuery);
    }
  }, [savedData]);


  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert(t("Publisher name is required"));
      return;
    }

    setActionLoading(true);
    actionAbortController.current = new AbortController();
    const signal = actionAbortController.current.signal;
    try {
      const url = editingPublisher
        ? `${API_BASE_URL}/publisher/${editingPublisher.id}`
        : `${API_BASE_URL}/publisher`;

      const method = editingPublisher ? 'PUT' : 'POST';
      const body = formData;

      const response = await staffFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || t("Failed to save publisher"));
      }

      actionAbortController.current = null;
      handleCancelForm();
      fetchPublishers();
      alert(t(editingPublisher ? "Publisher updated successfully!" : "Publisher created successfully!"));
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('Error saving publisher:', error);
      alert(t("Failed to save publisher") + " " + (error instanceof Error ? error.message : t("Please try again.")));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.publisher) return;

    setActionLoading(true);
    actionAbortController.current = new AbortController();
    const signal = actionAbortController.current.signal;
    try {
      const response = await staffFetch(`${API_BASE_URL}/publisher/${deleteModal.publisher.id}`, {
        method: 'DELETE',
        signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || t("Failed to delete publisher"));
      }

      actionAbortController.current = null;
      setDeleteModal({ isOpen: false, publisher: null });
      fetchPublishers();
      alert(t("Publisher deleted successfully!"));
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('Error deleting publisher:', error);
      alert(t("Failed to delete publisher") + " " + (error instanceof Error ? error.message : t("Please try again.")));
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
    setEditingPublisher(null);
    setFormData({ name: '', description: '' });
    onDataChange(null);
  };

  const saveCurrentState = () => {
    if (showForm || searchQuery) {
      onDataChange({
        showForm,
        formData,
        editingPublisher,
        searchQuery
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
    return (
      <div onClick={saveCurrentState}>
        <div className="card shadow-sm">
          <div className="card-header bg-primary text-white">
            <h5 className="mb-0">{editingPublisher ? t("Edit Publisher") : t("Add New Publisher")}</h5>
          </div>
          <div className="card-body">
            <div className="mb-3">
              <label className="form-label fw-semibold">{t("Publisher Name *")}</label>
              <input
                type="text"
                className="form-control"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder={t("Enter publisher name")}
              />
            </div>
            <div className="mb-4">
              <label className="form-label fw-semibold">{t("Description")}</label>
              <textarea
                className="form-control"
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={t("Enter publisher description")}
              />
            </div>
            <div className="d-flex gap-2">
              <button 
                className="btn btn-primary px-4" 
                onClick={handleSave}
                disabled={actionLoading || !formData.name.trim()}
              >
                {actionLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    {t("Saving...")}
                  </>
                ) : (
                  editingPublisher ? t("Update Publisher") : t("Create Publisher")
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
                {t("Cancel")}
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
          <h3 className="mb-1">{t("Publishers Management")}</h3>
          <p className="text-muted mb-0">{t("Manage book publishers and publishing houses")}</p>
        </div>
        <button className="btn btn-primary d-flex align-items-center gap-2" onClick={() => setShowForm(true)}>
          <span aria-hidden="true">+</span>
          {t("Add New Publisher")}
        </button>
      </div>

      {/* Search Card */}
      <div className="card mb-4 shadow-sm">
        <div className="card-header bg-light">
          <h6 className="mb-0">{t("Search Publishers")}</h6>
        </div>
        <div className="card-body">
          <input
            type="text"
            className="form-control"
            placeholder={t("Search by publisher name...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert alert-danger alert-dismissible" role="alert">
          <strong>{t("Error!")}</strong> {t("Could not load records.")}
        </div>
      )}

      {/* Publishers Table */}
      <div className="card shadow-sm">
        <div className="card-header bg-white">
          <div className="row align-items-center">
            <div className="col">
              <h6 className="mb-0">{t("All Publishers")}</h6>
            </div>
            <div className="col-auto">
              <div className="d-flex gap-4 small text-muted">
                <span>{t("Total:")} <strong>{totalPublishers}</strong></span>
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
              <p className="mt-3 text-muted">{t("Loading publishers...")}</p>
            </div>
          ) : publishers.length === 0 ? (
            <div className="text-center p-5">
              <div className="text-muted mb-3" style={{ fontSize: '3rem' }}><Icon name="building" size={28} /></div>
              <h5>{t("No Publishers Found")}</h5>
              <p className="text-muted mb-4">
                {searchQuery 
                  ? t("No publishers match your search query.")
                  : t("No publishers have been added yet.")
                }
              </p>
              {!searchQuery && (
                <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                  {t("Add First Publisher")}
                </button>
              )}
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0 library-record-table" role="table">
                <thead role="rowgroup" className="table-light">
                  <tr role="row">
                    <th role="columnheader" scope="col" className="border-0 fw-semibold">{t("Publisher Name")}</th>
                    <th role="columnheader" scope="col" className="border-0 fw-semibold">{t("Description")}</th>
                    <th role="columnheader" scope="col" className="border-0 fw-semibold text-end">{t("Actions")}</th>
                  </tr>
                </thead>
                <tbody role="rowgroup">
                  {publishers.map((publisher) => (
                    <tr role="row" key={publisher.id}>
                      <td role="cell" data-label={t("Publisher")} className="py-3">
                        <div className="fw-medium">{publisher.name}</div>
                      </td>
                      <td role="cell" data-label={t("Description")} className="py-3 text-muted">
                        {publisher.description || '-'}
                      </td>
                      <td role="cell" data-label={t("Actions")} className="py-3 text-end">
                        <div className="btn-group btn-group-sm">
                          <button
                            className="btn btn-outline-primary"
                            onClick={() => {
                              setEditingPublisher(publisher);
                              setFormData({
                                name: publisher.name,
                                description: publisher.description ?? ''
                              });
                              setShowForm(true);
                            }}
                            title={t("Edit publisher")}
                          >
                            {t("Edit")}
                          </button>
                          <button
                            className="btn btn-outline-danger"
                            onClick={() => setDeleteModal({ isOpen: true, publisher })}
                            title={t("Delete publisher")}
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
                <button type="button" className="btn-close" aria-label={t("Close")} onClick={() => setDeleteModal({ isOpen: false, publisher: null })}></button>
              </div>
              <div className="modal-body">
                <div className="text-center mb-3">
                  <div className="text-danger mb-3" style={{ fontSize: '3rem' }}><Icon name="warning" size={28} /></div>
                  <p className="mb-2">{t("Are you sure you want to delete “{name}”?", { name: deleteModal.publisher?.name ?? "" })}</p>
                  <p className="text-muted small">{t("This action cannot be undone.")}</p>
                </div>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setDeleteModal({ isOpen: false, publisher: null })}
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

export default PublishersSection;