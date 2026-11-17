import { useI18n } from '../../../shared/i18n';
import { usePaginatedList } from './usePaginatedList';
import { staffFetch } from './api';
import { useEffect, useRef, useState, type JSX } from 'react';
import type { Category } from './types';
import { API_BASE_URL } from './types';

interface SavedData {
  showForm?: boolean;
  formData?: { name: string; description: string };
  editingCategory?: Category | null;
  searchQuery?: string;
}

interface Props {
  savedData: SavedData | null;
  onDataChange: (data: SavedData | null) => void;
}

// Categories Section
const CategoriesSection = ({ savedData, onDataChange }: Props) => {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState(savedData?.searchQuery ?? '');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; category: Category | null }>({ isOpen: false, category: null });
  const [actionLoading, setActionLoading] = useState(false);
  const actionAbortController = useRef<AbortController | null>(null);

  const itemsPerPage = 20;
  const {
    items: categories, total: totalCategories, loading, error, currentPage, setCurrentPage, reload: fetchCategories,
  } = usePaginatedList<Category>('/categories', 'categories', 'total_count', searchQuery);
  const totalPages = Math.ceil(totalCategories / itemsPerPage);

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
      if (savedData.editingCategory) setEditingCategory(savedData.editingCategory);
      if (savedData.searchQuery) setSearchQuery(savedData.searchQuery);
    }
  }, [savedData]);


  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert(t("Category name is required"));
      return;
    }

    actionAbortController.current = new AbortController();
    const signal = actionAbortController.current.signal;

    setActionLoading(true);
    try {
      const url = editingCategory
        ? `${API_BASE_URL}/category/${editingCategory.id}`
        : `${API_BASE_URL}/category`;

      const method = editingCategory ? 'PUT' : 'POST';
      const body = formData;

      const response = await staffFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal
      });

      if (!response.ok) throw new Error(t("Failed to save category"));

      actionAbortController.current = null;
      handleCancelForm();
      fetchCategories();
      alert(t(editingCategory ? "Category updated successfully!" : "Category created successfully!"));
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      alert(t("Failed to save category. Please try again."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.category) return;

    actionAbortController.current = new AbortController();
    const signal = actionAbortController.current.signal;

    setActionLoading(true);
    try {
      const response = await staffFetch(`${API_BASE_URL}/category/${deleteModal.category.id}`, {
        method: 'DELETE',
        signal
      });

      if (!response.ok) throw new Error(t("Failed to delete category"));

      actionAbortController.current = null;
      setDeleteModal({ isOpen: false, category: null });
      // if the current page might become empty after deletion, move to previous page if possible
      const willBeEmpty = (totalCategories - 1) <= (currentPage - 1) * itemsPerPage;
      if (willBeEmpty && currentPage > 1) {
        setCurrentPage(prev => prev - 1);
      } else {
        fetchCategories();
      }
      alert(t("Category deleted successfully!"));
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      alert(t("Failed to delete category. Please try again."));
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
    setEditingCategory(null);
    setFormData({ name: '', description: '' });
    onDataChange(null);
  };

  const saveCurrentState = () => {
    if (showForm || searchQuery) {
      onDataChange({
        showForm,
        formData,
        editingCategory,
        searchQuery
      });
    }
  };

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
            <h5 className="mb-0">{editingCategory ? t("Edit Category") : t("Add New Category")}</h5>
          </div>
          <div className="card-body">
            <div className="mb-3">
              <label className="form-label fw-semibold">{t("Category Name *")}</label>
              <input
                type="text"
                className="form-control"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="mb-4">
              <label className="form-label fw-semibold">{t("Description")}</label>
              <textarea
                className="form-control"
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="d-flex gap-2">
              <button 
                className="btn btn-primary px-4" 
                onClick={handleSave}
                disabled={actionLoading}
              >
                {actionLoading ? t("Saving...") : (editingCategory ? t("Update") : t("Create"))}
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
          <h3 className="mb-1">{t("Categories Management")}</h3>
          <p className="text-muted mb-0">{t("Organize books by categories")}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          {t("+ Add New Category")}
        </button>
      </div>

      <div className="card mb-4 shadow-sm">
        <div className="card-body">
          <input
            type="text"
            className="form-control"
            placeholder={t("Search categories...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-header bg-white">
          <div className="row align-items-center">
            <div className="col"><h6 className="mb-0">{t("All Categories")}</h6></div>
            <div className="col-auto">
              <div className="d-flex gap-4 small text-muted">
                <span>{t("Total:")} <strong>{totalCategories}</strong></span>
                {totalPages > 1 && <span>{t("Page {page} of {total}", { page: currentPage, total: totalPages })}</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="card-body p-0">
          {error && <div className="alert alert-danger" role="alert">{t("Could not load records.")}</div>}
          {loading ? (
            <div className="text-center p-5">
              <div className="spinner-border text-primary"></div>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center p-5">
              <p className="mb-0">{t("No categories found")}</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0 library-record-table" role="table">
                <thead role="rowgroup" className="table-light">
                  <tr role="row">
                    <th role="columnheader" scope="col">{t("Name")}</th>
                    <th role="columnheader" scope="col">{t("Description")}</th>
                    <th role="columnheader" scope="col" className="text-end">{t("Actions")}</th>
                  </tr>
                </thead>
                <tbody role="rowgroup">
                  {categories.map((cat) => (
                    <tr role="row" key={cat.id}>
                      <td role="cell" data-label={t("Name")} className="fw-medium">{cat.name}</td>
                      <td role="cell" data-label={t("Description")} className="text-muted">{cat.description || '-'}</td>
                      <td role="cell" data-label={t("Actions")} className="text-end">
                        <div className="btn-group btn-group-sm">
                          <button
                            className="btn btn-outline-primary"
                            onClick={() => {
                              setEditingCategory(cat);
                              setFormData({ name: cat.name, description: cat.description ?? '' });
                              setShowForm(true);
                            }}
                          >
                            {t("Edit")}
                          </button>
                          <button
                            className="btn btn-outline-danger"
                            onClick={() => setDeleteModal({ isOpen: true, category: cat })}
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

      {deleteModal.isOpen && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{t("Confirm Delete")}</h5>
              </div>
              <div className="modal-body">
                <p>{t("Are you sure you want to delete “{name}”?", { name: deleteModal.category?.name ?? "" })}</p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setDeleteModal({ isOpen: false, category: null })} disabled={actionLoading}>
                  {t("Cancel")}
                </button>
                <button className="btn btn-danger" onClick={handleDelete} disabled={actionLoading}>
                  {actionLoading ? t("Deleting...") : t("Delete")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoriesSection;
