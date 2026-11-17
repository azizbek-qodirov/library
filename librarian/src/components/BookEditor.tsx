import { useI18n } from '../../../shared/i18n';
import { useMemo } from 'react';
import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import { readAPI } from './api';
import SearchableSelectAsync from './SearchableSelectAsync';
import type { Author, Book, BookFormData, Category, Publisher } from './types';

interface BookEditorProps {
    editingBook: Book | null;
    formData: BookFormData;
    setFormData: Dispatch<SetStateAction<BookFormData>>;
    imagePreview: string | null;
    actionLoading: boolean;
    handleFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
    handleSave: () => void;
    handleCancelForm: () => void;
}

async function fetchOptions<T extends { id: string; name: string }>(
    resource: string, search: string, signal?: AbortSignal
) {
    const params = new URLSearchParams({ search, limit: '50' });
    const page = await readAPI<Record<string, T[] | undefined>>(`/${resource}?${params}`, { signal });
    return (page[resource] ?? []).map(item => ({ id: item.id, label: item.name }));
}

const fetchAuthors = (search: string, signal?: AbortSignal) => fetchOptions<Author>('authors', search, signal);
const fetchPublishers = (search: string, signal?: AbortSignal) => fetchOptions<Publisher>('publishers', search, signal);
const fetchCategories = (search: string, signal?: AbortSignal) => fetchOptions<Category>('categories', search, signal);

export default function BookEditor({
    editingBook, formData, setFormData, imagePreview, actionLoading, handleFileChange, handleSave, handleCancelForm,
}: BookEditorProps) {
  const { t } = useI18n();
    const initialAuthors = useMemo(() => (editingBook?.author_ids ?? []).map(a => ({ id: a.id, label: a.name })), [editingBook]);
    const initialCategories = useMemo(() => (editingBook?.category_ids ?? []).map(c => ({ id: c.id, label: c.name })), [editingBook]);
    const initialPublishers = useMemo(() => editingBook?.publisher_id
        ? [{ id: editingBook.publisher_id.id, label: editingBook.publisher_id.name }]
        : [], [editingBook]);

    return (
        <div>
            <div className="card shadow-sm">
                <div className="card-header bg-primary text-white">
                    <h5 className="mb-0">{editingBook ? t("Edit Book") : t("Add New Book")}</h5>
                </div>
                <div className="card-body">
                    {/* Cover Image Upload */}
                    <div className="mb-4">
                        <label className="form-label fw-semibold">{t("Cover Image")}</label>
                        <div className="row">
                            <div className="col-md-8">
                                <input
                                    type="file"
                                    className="form-control"
                                    accept="image/jpeg,image/png,image/gif,image/webp"
                                    onChange={handleFileChange}
                                />
                                <small className="text-muted">{t("Upload a book cover image (JPG, PNG, max 5MB)")}</small>
                            </div>
                            <div className="col-md-4">
                                {(imagePreview || editingBook?.cover_image_id?.url) && (
                                    <div className="text-center">
                                        <img
                                            src={imagePreview || editingBook?.cover_image_id?.url}
                                            alt={t("Cover preview")}
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
                            <label className="form-label fw-semibold">{t("Title *")}</label>
                            <input
                                type="text"
                                className="form-control"
                                value={formData.title}
                                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                placeholder={t("Enter book title")}
                            />
                        </div>
                        <div className="col-md-6 mb-3">
                            <label className="form-label fw-semibold">{t("ISBN (optional)")}</label>
                            <input
                                type="text"
                                className="form-control"
                                value={formData.isbn}
                                onChange={(e) => setFormData(prev => ({ ...prev, isbn: e.target.value }))}
                                placeholder={t("Enter ISBN number")}
                            />
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label className="form-label fw-semibold">{t("Location")}</label>
                            <input
                                type="text"
                                className="form-control"
                                placeholder={t("e.g., Shelf A-12")}
                                value={formData.location}
                                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                            />
                        </div>
                        <div className="col-md-6 mb-3">
                            <label className="form-label fw-semibold">{t("Language")}</label>
                            <input
                                type="text"
                                className="form-control"
                                placeholder={t("e.g., eng, uzb, rus")}
                                value={formData.language}
                                onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-md-3 mb-3">
                            <label className="form-label fw-semibold">{t("Published Date")}</label>
                            <input
                                type="date"
                                className="form-control"
                                value={formData.published_date}
                                onChange={(e) => setFormData(prev => ({ ...prev, published_date: e.target.value }))}
                            />
                        </div>
                        <div className="col-md-3 mb-3">
                            <label className="form-label fw-semibold" htmlFor="publication-year">{t("Edition year")}</label>
                            <input
                                id="publication-year"
                                type="number"
                                className="form-control"
                                min="1"
                                max="9999"
                                step="1"
                                value={formData.publication_year}
                                onChange={(e) => setFormData(prev => ({ ...prev, publication_year: e.target.value }))}
                            />
                        </div>
                        <div className="col-md-3 mb-3">
                            <label className="form-label fw-semibold">{t("Page Count")}</label>
                            <input
                                type="number"
                                className="form-control"
                                min="0"
                                value={formData.page_count}
                                onChange={(e) => setFormData(prev => ({ ...prev, page_count: parseInt(e.target.value) || 0 }))}
                            />
                        </div>
                        <div className="col-md-3 mb-3">
                            <SearchableSelectAsync
                                label={t("Publisher")}
                                fetchOptions={fetchPublishers}
                                initialOptions={initialPublishers}
                                value={formData.publisher_id}
                                onChange={(value) => setFormData(prev => ({ ...prev, publisher_id: value as string }))}
                                placeholder={t("Search publisher...")}
                                multiple={false}
                            />
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-md-4 mb-3">
                            <label className="form-label fw-semibold">{t("Total Copies")}</label>
                            <input
                                type="number"
                                className="form-control"
                                min="0"
                                value={formData.total_copies}
                                onChange={(e) => setFormData(prev => ({ ...prev, total_copies: parseInt(e.target.value) || 0 }))}
                            />
                        </div>
                        <div className="col-md-4 mb-3">
                            <label className="form-label fw-semibold d-block">{t("Reference Only")}</label>
                            <div className="form-check mt-2">
                                <input
                                    type="checkbox"
                                    className="form-check-input"
                                    id="referenceOnly"
                                    checked={formData.is_reference_only}
                                    onChange={(e) => setFormData(prev => ({ ...prev, is_reference_only: e.target.checked }))}
                                />
                                <label className="form-check-label" htmlFor="referenceOnly">
                                    {t("Cannot be borrowed")}
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="mb-3">
                        <label className="form-label fw-semibold">{t("Description")}</label>
                        <textarea
                            className="form-control"
                            rows={3}
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder={t("Enter book description")}
                        />
                    </div>

                    {/* Authors Selection */}
                    <div className="mb-3">
                        <SearchableSelectAsync
                            label={t("Authors")}
                            fetchOptions={fetchAuthors}
                                initialOptions={initialAuthors}
                            value={formData.author_ids}
                            onChange={(value) => setFormData(prev => ({ ...prev, author_ids: value as string[] }))}
                            placeholder={t("Search and select authors...")}
                            multiple={true}
                        />
                    </div>

                    {/* Categories Selection */}
                    <div className="mb-4">
                        <SearchableSelectAsync
                            label={t("Categories")}
                            fetchOptions={fetchCategories}
                                initialOptions={initialCategories}
                            value={formData.category_ids}
                            onChange={(value) => setFormData(prev => ({ ...prev, category_ids: value as string[] }))}
                            placeholder={t("Search and select categories...")}
                            multiple={true}
                        />
                    </div>

                    <div className="d-flex gap-2">
                        <button
                            className="btn btn-primary px-4"
                            onClick={handleSave}
                            disabled={actionLoading || !formData.title.trim()}
                        >
                            {actionLoading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2"></span>
                                    {formData.cover_image_file ? t("Uploading & Saving...") : t("Saving...")}
                                </>
                            ) : (
                                editingBook ? t("Update Book") : t("Create Book")
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
