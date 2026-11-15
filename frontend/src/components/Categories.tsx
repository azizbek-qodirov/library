import { useCallback, useEffect, useState } from "react";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("recommended");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    search: "",
    categoryIds: [],
    authorIds: [],
    publisherId: "",
    isReferenceOnly: "all"
  });
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Store selected authors and publishers for display
  const [selectedAuthors, setSelectedAuthors] = useState<SelectedItem[]>([]);
  const [selectedPublisher, setSelectedPublisher] = useState<SelectedItem | null>(null);

  // Initialize from URL parameters on mount
  useEffect(() => {
    const categoryParam = searchParams.get("category") || "recommended";
    const searchParam = searchParams.get("search") || "";
    const categoryIdsParam = searchParams.get("categoryIds");
    const authorIdsParam = searchParams.get("authorIds");
    const publisherIdParam = searchParams.get("publisherId") || "";
    const referenceParam = searchParams.get("isReferenceOnly") || "all";
    const authorNamesParam = searchParams.get("authorNames");
    const publisherNameParam = searchParams.get("publisherName");

    setSelectedCategory(categoryParam);
    setSearchTerm(searchParam);
    setSearchFilters({
      search: searchParam,
      categoryIds: categoryIdsParam ? categoryIdsParam.split(",") : [],
      authorIds: authorIdsParam ? authorIdsParam.split(",") : [],
      publisherId: publisherIdParam,
      isReferenceOnly: referenceParam
    });

    // Restore selected authors and publisher names
    if (authorIdsParam && authorNamesParam) {
      const ids = authorIdsParam.split(",");
      const names = authorNamesParam.split(",");
      setSelectedAuthors(ids.map((id, index) => ({ id, name: names[index] || id })));
    }
    if (publisherIdParam && publisherNameParam) {
      setSelectedPublisher({ id: publisherIdParam, name: publisherNameParam });
    }
  }, []); // Only run on mount

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
  }, [selectedCategory, searchTerm, searchFilters, selectedAuthors, selectedPublisher]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 1000);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Auto-switch to "all" category when searching
  useEffect(() => {
    if (debouncedSearch.trim() || hasActiveFilters()) {
      setSelectedCategory("all");
    }
  }, [debouncedSearch]);

  // Fetch top 15 categories with most books
  useEffect(() => {
    const abortController = new AbortController();

    const fetchCategories = async () => {
      setCategoriesError(null);
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/categories?limit=100&offset=0`, {
          signal: abortController.signal
        });
        if (!res.ok) {
          throw new Error(`Failed to fetch categories: ${res.statusText}`);
        }
        const data = await res.json();
        const allCategories = data.categories || [];

        // Get top 15 categories with most books
        const categoriesWithCounts = await Promise.all(
          allCategories.map(async (category: Category) => {
            try {
              const booksRes = await fetch(
                `${import.meta.env.VITE_API_URL}/books?category_ids=${category.id}&limit=1`,
                { signal: abortController.signal }
              );
              if (booksRes.ok) {
                const booksData = await booksRes.json();
                return { ...category, bookCount: booksData.total_count || 0 };
              }
              return { ...category, bookCount: 0 };
            } catch {
              return { ...category, bookCount: 0 };
            }
          })
        );

        // Sort by book count and take top 15
        const topCategories = categoriesWithCounts
          .sort((a, b) => b.bookCount - a.bookCount)
          .slice(0, 15);

        setCategories(topCategories);
      } catch (err: any) {
        if (err.name === 'AbortError') return; // Ignore abort errors
        console.error("Failed to fetch categories:", err);
        setCategoriesError(err instanceof Error ? err.message : 'Failed to load categories');
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
      case "author":
        const newAuthorIds = searchFilters.authorIds.filter(id => id !== value);
        updateFilters(
          { authorIds: newAuthorIds },
          { authors: selectedAuthors.filter(a => a.id !== value) }
        );
        break;
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
        label: `Search: "${debouncedSearch}"`,
        value: ""
      });
    }

    searchFilters.categoryIds.forEach(categoryId => {
      const category = categories.find(c => c.id === categoryId);
      if (category) {
        filters.push({
          type: "category",
          label: `Category: ${category.name}`,
          value: categoryId
        });
      }
    });

    selectedAuthors.forEach(author => {
      filters.push({
        type: "author",
        label: `Author: ${author.name}`,
        value: author.id
      });
    });

    if (selectedPublisher) {
      filters.push({
        type: "publisher",
        label: `Publisher: ${selectedPublisher.name}`,
        value: ""
      });
    }

    if (searchFilters.isReferenceOnly !== "all") {
      filters.push({
        type: "reference",
        label: searchFilters.isReferenceOnly === "true" ? "Reference Only" : "Borrowable Books",
        value: ""
      });
    }

    return filters;
  };

  const allCategories = [
    { id: "recommended", name: "Tavsiya qilingan" },
    { id: "all", name: "Hammasi" },
    ...categories
  ];

  const currentFilters = {
    ...searchFilters,
    search: debouncedSearch
  };

  const isSearchActive = debouncedSearch.trim() || hasActiveFilters();
  const selectedFilters = getSelectedFiltersDisplay();

  return (
    <div className="categories-page">
      <div className="categories-header">
        <div className="container">
          <h1 className="categories-title">Kutubxona katalogi</h1>

          {/* Main Search Bar */}
          <div className="search-section">
            <div className="search-bar">
              <input
                type="text"
                className="search-input form-control"
                placeholder="Kitoblarni nomi, muallifi yoki ISBN raqami bo'yicha qidirish..."
                value={searchTerm}
                onChange={handleSearchChange}
              />
            </div>

            {/* Advanced Search Toggle */}
            <div className="advanced-search-toggle">
              <button
                className={`advanced-toggle-btn ${showAdvanced ? "active" : ""}`}
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                Kengaytirilgan qidiruvni {showAdvanced ? "yashirish" : "ko'rsatish"}
              </button>
            </div>

            {/* Advanced Search Panel */}
            {showAdvanced && (
              <AdvancedSearchPanel
                filters={searchFilters}
                categories={categories}
                selectedAuthors={selectedAuthors}
                selectedPublisher={selectedPublisher}
                onFiltersChange={updateFilters}
              />
            )}

            {/* Selected Filters */}
            {selectedFilters.length > 0 && (
              <div className="selected-filters">
                <span className="selected-filters-label">Active Filters:</span>
                {selectedFilters.map((filter, index) => (
                  <span key={index} className="filter-tag">
                    {filter.label}
                    <button
                      className="filter-tag-remove"
                      onClick={() => removeFilter(filter.type, filter.value)}
                      title="Remove filter"
                    >
                      ✕
                    </button>
                  </span>
                ))}
                <button
                  className="clear-filters-btn"
                  onClick={clearAllFilters}
                >
                  Clear All
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
            <strong>Warning:</strong> {categoriesError}
            <button
              type="button"
              className="btn-close"
              onClick={() => setCategoriesError(null)}
              aria-label="Close"
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
                onClick={() => handleCategorySelect(category.id)}
                disabled={isDisabled}
                title={isDisabled ? "Clear search/filters to switch categories" : ""}
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
