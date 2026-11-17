import { useI18n } from '../../../shared/i18n';
import { API_BASE_URL } from '../api';
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AdvancedSearchPanel from "./AdvancedSearchPanel";
import BookList from "./BookList";
import BookPopup from "./BookPopup";
import type { Author, Book, Category, Publisher } from "./types";

interface SearchFilters {
  search: string;
  categoryIds: string[];
  authorIds: string[];
  publisherId: string;
  isReferenceOnly: string; // "all" | "true" | "false"
}

interface SelectedItem {
  id: string;
  name: string;
}

function Categories() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState(() => searchParams.get("category") || "recommended");
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get("search") || "");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [categoriesError, setCategoriesError] = useState(false);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(() => ({
    search: searchParams.get("search") || "",
    categoryIds: searchParams.get("categoryIds")?.split(",") ?? [],
    authorIds: searchParams.get("authorIds")?.split(",") ?? [],
    publisherId: searchParams.get("publisherId") || "",
    isReferenceOnly: searchParams.get("isReferenceOnly") || "all"
  }));
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);

  // Store selected authors and publishers for display
  const [selectedAuthors, setSelectedAuthors] = useState<SelectedItem[]>(() => {
    const names = searchParams.get("authorNames")?.split(",") ?? [];
    return searchFilters.authorIds.map((id, index) => ({ id, name: names[index] || id }));
  });
  const [selectedPublisher, setSelectedPublisher] = useState<SelectedItem | null>(() => searchFilters.publisherId ? {
    id: searchFilters.publisherId, name: searchParams.get("publisherName") || searchFilters.publisherId
  } : null);

  // Update URL parameters whenever state changes
  useEffect(() => {
    const params = new URLSearchParams();

    if (selectedCategory !== "recommended") {
      params.set("category", selectedCategory);
    }
    if (searchTerm) {
      params.set("search", searchTerm);
    }
    if (searchFilters.categoryIds.length > 0) {
      params.set("categoryIds", searchFilters.categoryIds.join(","));
    }
    if (searchFilters.authorIds.length > 0) {
      params.set("authorIds", searchFilters.authorIds.join(","));
      if (selectedAuthors.length > 0) {
        params.set("authorNames", selectedAuthors.map(a => a.name).join(","));
      }
    }
    if (searchFilters.publisherId) {
      params.set("publisherId", searchFilters.publisherId);
      if (selectedPublisher) {
        params.set("publisherName", selectedPublisher.name);
      }
    }
    if (searchFilters.isReferenceOnly !== "all") {
      params.set("isReferenceOnly", searchFilters.isReferenceOnly);
    }

    setSearchParams(params, { replace: true });
  }, [selectedCategory, searchTerm, searchFilters, selectedAuthors, selectedPublisher, setSearchParams]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 1000);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch top 15 categories with most books
  useEffect(() => {
    const abortController = new AbortController();

    const fetchCategories = async () => {
      setCategoriesError(false);
      try {
        const res = await fetch(`${API_BASE_URL}/categories?limit=15&sort=book_count`, {
          signal: abortController.signal
        });
        if (!res.ok) {
          throw new Error(`Failed to fetch categories: ${res.statusText}`);
        }
        const data = await res.json();
        setCategories(data.categories || []);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return; // Ignore abort errors
        console.error("Failed to fetch categories:", err);
        setCategoriesError(true);
      }
    };

    fetchCategories();

    return () => {
      abortController.abort();
    };
  }, []);

  const hasActiveFilters = useCallback(() => {
    return (
      searchFilters.categoryIds.length > 0 ||
      searchFilters.authorIds.length > 0 ||
      searchFilters.publisherId ||
      searchFilters.isReferenceOnly !== "all"
    );
  }, [searchFilters]);

  // Auto-switch to "all" category when searching
  useEffect(() => {
    if (debouncedSearch.trim() || hasActiveFilters()) {
      setSelectedCategory("all");
    }
  }, [debouncedSearch, hasActiveFilters]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleCategorySelect = (categoryId: string) => {
    // Don't allow switching away from "all" if there's active search/filters
    if (debouncedSearch.trim() || hasActiveFilters()) {
      return;
    }
    setSelectedCategory(categoryId);
  };

  const updateFilters = (newFilters: Partial<SearchFilters>, selectedItems?: {
    authors?: Author[];
    publisher?: Publisher | null;
  }) => {
    setSearchFilters(prev => ({ ...prev, ...newFilters }));

    // Update selected authors for display
    if (selectedItems?.authors) {
      setSelectedAuthors(selectedItems.authors.map(a => ({ id: a.id, name: a.name })));
    }

    // Update selected publisher for display
    if (selectedItems?.publisher !== undefined) {
      setSelectedPublisher(selectedItems.publisher ? { id: selectedItems.publisher.id, name: selectedItems.publisher.name } : null);
    }
  };

  const handleBookClick = (book: Book) => {
    setSelectedBook(book);
  };

  const handleClosePopup = () => {
    setSelectedBook(null);
  };

  const clearAllFilters = () => {
    setSearchFilters({
      search: "",
      categoryIds: [],
      authorIds: [],
      publisherId: "",
      isReferenceOnly: "all"
    });
    setSearchTerm("");
    setSelectedAuthors([]);
    setSelectedPublisher(null);
  };

  const removeFilter = (filterType: string, value?: string) => {
    switch (filterType) {
      case "search":
        setSearchTerm("");
        break;
      case "category":
        updateFilters({
          categoryIds: searchFilters.categoryIds.filter(id => id !== value)
        });
        break;
      case "author": {
        const newAuthorIds = searchFilters.authorIds.filter(id => id !== value);
        updateFilters(
          { authorIds: newAuthorIds },
          { authors: selectedAuthors.filter(a => a.id !== value) }
        );
        break;
      }
      case "publisher":
        updateFilters({ publisherId: "" }, { publisher: null });
        break;
      case "reference":
        updateFilters({ isReferenceOnly: "all" });
        break;
    }
  };

  const getSelectedFiltersDisplay = () => {
    const filters = [];

    if (debouncedSearch.trim()) {
      filters.push({
        type: "search",
        label: t("Search: {value}", { value: debouncedSearch }),
        value: ""
      });
    }

    searchFilters.categoryIds.forEach(categoryId => {
      const category = categories.find(c => c.id === categoryId);
      if (category) {
        filters.push({
          type: "category",
          label: t("Category: {value}", { value: category.name }),
          value: categoryId
        });
      }
    });

    selectedAuthors.forEach(author => {
      filters.push({
        type: "author",
        label: t("Author: {value}", { value: author.name }),
        value: author.id
      });
    });

    if (selectedPublisher) {
      filters.push({
        type: "publisher",
        label: t("Publisher: {value}", { value: selectedPublisher.name }),
        value: ""
      });
    }

    if (searchFilters.isReferenceOnly !== "all") {
      filters.push({
        type: "reference",
        label: searchFilters.isReferenceOnly === "true" ? t("Reference Only") : t("Borrowable Books"),
        value: ""
      });
    }

    return filters;
  };

  const allCategories = [
    { id: "recommended", name: t("Recommended titles") },
    { id: "all", name: t("All") },
    ...categories
  ];

  const currentFilters = useMemo(() => ({ ...searchFilters, search: debouncedSearch }), [searchFilters, debouncedSearch]);

  const isSearchActive = debouncedSearch.trim() || hasActiveFilters();
  const selectedFilters = getSelectedFiltersDisplay();

  return (
    <div className="categories-page">
      <div className="categories-header">
        <div className="container">
          <h1 className="categories-title">{t("Library catalog")}</h1>

          {/* Main Search Bar */}
          <div className="search-section">
            <div className="search-bar">
              <input
                type="search"
                enterKeyHint="search"
                aria-label={t("Search books")}
                className="search-input form-control"
                placeholder={t("Title, author, ISBN, or barcode…")}
                value={searchTerm}
                onChange={handleSearchChange}
              />
            </div>

            {/* Advanced Search Toggle */}
            <div className="advanced-search-toggle">
              <button
                className={`advanced-toggle-btn ${showAdvanced ? "active" : ""}`}
                aria-expanded={showAdvanced}
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {t(showAdvanced ? "Hide advanced search" : "Show advanced search")}
              </button>
            </div>

            {/* Advanced Search Panel */}
            {showAdvanced && (
              <AdvancedSearchPanel
                filters={searchFilters}
                selectedAuthors={selectedAuthors}
                onFiltersChange={updateFilters}
              />
            )}

            {/* Selected Filters */}
            {selectedFilters.length > 0 && (
              <div className="selected-filters">
                <span className="selected-filters-label">{t("Active Filters:")}</span>
                {selectedFilters.map((filter, index) => (
                  <span key={index} className="filter-tag">
                    {filter.label}
                    <button
                      className="filter-tag-remove"
                      onClick={() => removeFilter(filter.type, filter.value)}
                      title={t("Remove filter")}
                    >
                      ✕
                    </button>
                  </span>
                ))}
                <button
                  className="clear-filters-btn"
                  onClick={clearAllFilters}
                >
                  {t("Clear All")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Category Error Alert */}
      {categoriesError && (
        <div className="container mt-3">
          <div className="alert alert-warning alert-dismissible fade show" role="alert">
            <strong>{t("Warning:")}</strong> {t("Failed to load categories")}
            <button
              type="button"
              className="btn-close"
              onClick={() => setCategoriesError(false)}
              aria-label={t("Close")}
            ></button>
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="container">
        <div className="category-tabs">
          {allCategories.map((category) => {
            const isDisabled = !!isSearchActive && category.id !== "all";
            return (
              <button
                key={category.id}
                className={`category-tab ${selectedCategory === category.id ? "active" : ""} ${
                  isDisabled ? "disabled" : ""
                }`}
                aria-pressed={selectedCategory === category.id}
                onClick={() => handleCategorySelect(category.id)}
                disabled={isDisabled}
                title={isDisabled ? t("Clear search/filters to switch categories") : ""}
              >
                {category.name}
              </button>
            );
          })}
        </div>

        {/* Books List */}
        <BookList
          category={selectedCategory}
          filters={currentFilters}
          onBookClick={handleBookClick}
          key={`${selectedCategory}-${JSON.stringify(currentFilters)}`}
        />
      </div>

      {/* Book Popup */}
      {selectedBook && (
        <BookPopup
          book={selectedBook}
          onClose={handleClosePopup}
        />
      )}
    </div>
  );
}

export default Categories;
