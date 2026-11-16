import { API_BASE_URL } from '../api';
import { useEffect, useState } from "react";
import type { Author, Category, Publisher } from "./types";

interface SearchFilters {
    search: string;
    categoryIds: string[];
    authorIds: string[];
    publisherId: string;
    isReferenceOnly: string;
}

interface SelectedItem {
    id: string;
    name: string;
}

interface Props {
    filters: SearchFilters;
    selectedAuthors: SelectedItem[];
    onFiltersChange: (filters: Partial<SearchFilters>, selectedItems?: {
        authors?: Author[];
        publisher?: Publisher | null;
    }) => void;
}

function AdvancedSearchPanel({ filters, selectedAuthors, onFiltersChange }: Props) {
    const [categorySearch, setCategorySearch] = useState("");
    const [authorSearch, setAuthorSearch] = useState("");
    const [publisherSearch, setPublisherSearch] = useState("");

    const [allCategories, setAllCategories] = useState<Category[]>([]);
    const [authors, setAuthors] = useState<Author[]>([]);
    const [publishers, setPublishers] = useState<Publisher[]>([]);
    const [authorsLoading, setAuthorsLoading] = useState(false);
    const [publishersLoading, setPublishersLoading] = useState(false);
    const [authorsError, setAuthorsError] = useState<string | null>(null);
    const [publishersError, setPublishersError] = useState<string | null>(null);

    // Fetch ALL categories for the dropdown
    useEffect(() => {
        const abortController = new AbortController();

        const fetchAllCategories = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/categories?limit=100&offset=0`, {
                    signal: abortController.signal
                });
                if (!res.ok) {
                    throw new Error(`Failed to fetch categories: ${res.statusText}`);
                }
                const data = await res.json();
                setAllCategories(data.categories || []);
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') return;
                console.error("Failed to fetch all categories:", err);
            }
        };

        fetchAllCategories();

        return () => {
            abortController.abort();
        };
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        setAuthors([]);
        setAuthorsError(null);
        setAuthorsLoading(Boolean(authorSearch.trim()));
        if (!authorSearch.trim()) return;

        const timer = setTimeout(async () => {
            try {
                const res = await fetch(
                    `${API_BASE_URL}/authors?search=${encodeURIComponent(authorSearch)}&limit=50`,
                    { signal: controller.signal }
                );
                if (!res.ok) throw new Error(`Failed to fetch authors: ${res.statusText}`);
                const data = await res.json();
                if (!controller.signal.aborted) setAuthors(data.authors || []);
            } catch (err) {
                if (!controller.signal.aborted) setAuthorsError(err instanceof Error ? err.message : 'Failed to load authors');
            } finally {
                if (!controller.signal.aborted) setAuthorsLoading(false);
            }
        }, 500);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [authorSearch]);

    useEffect(() => {
        const controller = new AbortController();
        setPublishers([]);
        setPublishersError(null);
        setPublishersLoading(Boolean(publisherSearch.trim()));
        if (!publisherSearch.trim()) return;

        const timer = setTimeout(async () => {
            try {
                const res = await fetch(
                    `${API_BASE_URL}/publishers?search=${encodeURIComponent(publisherSearch)}&limit=50`,
                    { signal: controller.signal }
                );
                if (!res.ok) throw new Error(`Failed to fetch publishers: ${res.statusText}`);
                const data = await res.json();
                if (!controller.signal.aborted) setPublishers(data.publishers || []);
            } catch (err) {
                if (!controller.signal.aborted) setPublishersError(err instanceof Error ? err.message : 'Failed to load publishers');
            } finally {
                if (!controller.signal.aborted) setPublishersLoading(false);
            }
        }, 500);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [publisherSearch]);

    const filteredCategories = allCategories.filter(category =>
        category.name.toLowerCase().includes(categorySearch.toLowerCase())
    );

    const handleCategoryToggle = (categoryId: string) => {
        const newCategoryIds = filters.categoryIds.includes(categoryId)
            ? filters.categoryIds.filter(id => id !== categoryId)
            : [...filters.categoryIds, categoryId];

        onFiltersChange({ categoryIds: newCategoryIds });
    };

    const handleAuthorToggle = (author: Author) => {
        const isSelected = filters.authorIds.includes(author.id);
        const newAuthorIds = isSelected
            ? filters.authorIds.filter(id => id !== author.id)
            : [...filters.authorIds, author.id];

        const newSelectedAuthors = isSelected
            ? selectedAuthors.filter(a => a.id !== author.id)
            : [...selectedAuthors, { id: author.id, name: author.name }];

        onFiltersChange(
            { authorIds: newAuthorIds },
            { authors: newSelectedAuthors.map(a => ({ id: a.id, name: a.name } as Author)) }
        );
    };

    const handlePublisherSelect = (publisher: Publisher) => {
        const isSelected = filters.publisherId === publisher.id;

        onFiltersChange(
            { publisherId: isSelected ? "" : publisher.id },
            { publisher: isSelected ? null : publisher }
        );
    };

    const handleReferenceChange = (value: string) => {
        onFiltersChange({ isReferenceOnly: value });
    };

    const clearCategories = () => {
        onFiltersChange({ categoryIds: [] });
    };

    const clearAuthors = () => {
        onFiltersChange({ authorIds: [] }, { authors: [] });
    };

    return (
        <div className="advanced-search-panel">
            <div className="row">
                {/* Categories Filter */}
                <div className="col-lg-3 col-md-6 mb-3">
                    <div className="filter-group">
                        <label className="filter-label">Categories</label>
                        <input
                            type="text"
                            className="filter-search-input form-control form-control-sm"
                            placeholder="Search categories..."
                            value={categorySearch}
                            onChange={(e) => setCategorySearch(e.target.value)}
                        />
                        <div className="filter-options">
                            {filteredCategories.map((category) => (
                                <div key={category.id} className="filter-option">
                                    <label className="d-flex align-items-center mb-0">
                                        <input
                                            type="checkbox"
                                            className="form-check-input me-2"
                                            checked={filters.categoryIds.includes(category.id)}
                                            onChange={() => handleCategoryToggle(category.id)}
                                        />
                                        <span className="flex-grow-1">{category.name}</span>
                                    </label>
                                </div>
                            ))}
                            {filteredCategories.length === 0 && categorySearch && (
                                <div className="filter-option text-muted">
                                    No categories found
                                </div>
                            )}
                            {filteredCategories.length === 0 && !categorySearch && (
                                <div className="filter-option text-muted">
                                    No categories available
                                </div>
                            )}
                            {filters.categoryIds.length > 0 && (
                                <div className="filter-option">
                                    <button
                                        className="btn btn-sm btn-outline-secondary w-100"
                                        onClick={clearCategories}
                                    >
                                        Clear Selection
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Authors Filter */}
                <div className="col-lg-3 col-md-6 mb-3">
                    <div className="filter-group">
                        <label className="filter-label">Mualliflar</label>
                        <input
                            type="text"
                            className="filter-search-input form-control form-control-sm"
                            placeholder="Mualliflarni qidirish..."
                            value={authorSearch}
                            onChange={(e) => setAuthorSearch(e.target.value)}
                        />
                        <div className="filter-options">
                            {authorsLoading && (
                                <div className="filter-option text-center">
                                    <div className="spinner-border spinner-border-sm" role="status">
                                        <span className="visually-hidden">Yuklanmoqda...</span>
                                    </div>
                                </div>
                            )}
                            {authorsError && (
                                <div className="filter-option text-danger">
                                    <small>{authorsError}</small>
                                </div>
                            )}
                            {authors.map((author) => (
                                <div key={author.id} className="filter-option">
                                    <label className="d-flex align-items-center mb-0">
                                        <input
                                            type="checkbox"
                                            className="form-check-input me-2"
                                            checked={filters.authorIds.includes(author.id)}
                                            onChange={() => handleAuthorToggle(author)}
                                        />
                                        <span className="flex-grow-1">{author.name}</span>
                                    </label>
                                </div>
                            ))}
                            {authors.length === 0 && authorSearch.trim() && !authorsLoading && (
                                <div className="filter-option text-muted">
                                    Qidiruv natijasi bo'yicha mualliflar topilmadi!
                                </div>
                            )}
                            {!authorSearch.trim() && (
                                <div className="filter-option text-muted">
                                    Mualliflarni qidirish uchun yozing...
                                </div>
                            )}
                            {filters.authorIds.length > 0 && (
                                <div className="filter-option">
                                    <button
                                        className="btn btn-sm btn-outline-secondary w-100"
                                        onClick={clearAuthors}
                                    >
                                        Clear Selection
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Publishers Filter */}
                <div className="col-lg-3 col-md-6 mb-3">
                    <div className="filter-group">
                        <label className="filter-label">Publisher</label>
                        <input
                            type="text"
                            className="filter-search-input form-control form-control-sm"
                            placeholder="Search publishers..."
                            value={publisherSearch}
                            onChange={(e) => setPublisherSearch(e.target.value)}
                        />
                        <div className="filter-options">
                            {publishersLoading && (
                                <div className="filter-option text-center">
                                    <div className="spinner-border spinner-border-sm" role="status">
                                        <span className="visually-hidden">Yuklanmoqda...</span>
                                    </div>
                                </div>
                            )}
                            {publishersError && (
                                <div className="filter-option text-danger">
                                    <small>{publishersError}</small>
                                </div>
                            )}
                            {publishers.map((publisher) => (
                                <div key={publisher.id} className="filter-option">
                                    <label className="d-flex align-items-center mb-0">
                                        <input
                                            type="radio"
                                            className="form-check-input me-2"
                                            name="publisher"
                                            checked={filters.publisherId === publisher.id}
                                            onChange={() => handlePublisherSelect(publisher)}
                                        />
                                        <span className="flex-grow-1">{publisher.name}</span>
                                    </label>
                                </div>
                            ))}
                            {publishers.length === 0 && publisherSearch.trim() && !publishersLoading && (
                                <div className="filter-option text-muted">
                                    No publishers found
                                </div>
                            )}
                            {!publisherSearch.trim() && (
                                <div className="filter-option text-muted">
                                    Type to search publishers
                                </div>
                            )}
                            {filters.publisherId && (
                                <div className="filter-option">
                                    <button
                                        className="btn btn-sm btn-outline-secondary w-100"
                                        onClick={() => onFiltersChange({ publisherId: "" }, { publisher: null })}
                                    >
                                        Clear Selection
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Reference Only Filter */}
                <div className="col-lg-3 col-md-6 mb-3">
                    <div className="filter-group">
                        <label className="filter-label">Kitob turi</label>
                        <div className="reference-filter">
                            <div className="form-check">
                                <input
                                    className="form-check-input"
                                    type="radio"
                                    name="referenceOnly"
                                    id="referenceAll"
                                    value="all"
                                    checked={filters.isReferenceOnly === "all"}
                                    onChange={(e) => handleReferenceChange(e.target.value)}
                                />
                                <label className="form-check-label" htmlFor="referenceAll">
                                    Barchasi
                                </label>
                            </div>
                            <div className="form-check">
                                <input
                                    className="form-check-input"
                                    type="radio"
                                    name="referenceOnly"
                                    id="referenceTrue"
                                    value="true"
                                    checked={filters.isReferenceOnly === "true"}
                                    onChange={(e) => handleReferenceChange(e.target.value)}
                                />
                                <label className="form-check-label" htmlFor="referenceTrue">
                                    Faqat kutubxonada foydalanish uchun
                                </label>
                            </div>
                            <div className="form-check">
                                <input
                                    className="form-check-input"
                                    type="radio"
                                    name="referenceOnly"
                                    id="referenceFalse"
                                    value="false"
                                    checked={filters.isReferenceOnly === "false"}
                                    onChange={(e) => handleReferenceChange(e.target.value)}
                                />
                                <label className="form-check-label" htmlFor="referenceFalse">
                                    Uyga olib ketish mumkin
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Debounce utility function
export default AdvancedSearchPanel;
