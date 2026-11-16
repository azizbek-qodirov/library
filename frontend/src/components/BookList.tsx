import { API_BASE_URL } from '../api';
import { useEffect, useState } from "react";
import BookCard from "./BookCard";
import type { Book } from "./types";

interface SearchFilters {
  search: string;
  categoryIds: string[];
  authorIds: string[];
  publisherId: string;
  isReferenceOnly: string;
}

interface Props {
  category: string;
  filters: SearchFilters;
  onBookClick?: (book: Book) => void;
}

interface BookResponse {
  books: Book[];
  total_count: number;
}

interface RecommendedResponse {
  recommendeds: Array<{ book_id: Book }>;
  total_count: number;
}

function BookList({ category, filters, onBookClick }: Props) {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalBooks, setTotalBooks] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const booksPerPage = 20;
  const totalPages = Math.ceil(totalBooks / booksPerPage);

  // Reset to first page when category or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [category, filters]);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchBooks = async () => {
      setLoading(true);
      setError(null);

      try {
        const offset = (currentPage - 1) * booksPerPage;
        let endpoint = "";
        const params = new URLSearchParams();

        // Add pagination
        params.append("limit", booksPerPage.toString());
        params.append("offset", offset.toString());

        if (category === "recommended") {
          endpoint = `${API_BASE_URL}/recommended`;
        } else {
          endpoint = `${API_BASE_URL}/books`;

          // Add search parameter
          if (filters.search.trim()) {
            params.append("search", filters.search.trim());
          }

          // Add category filter (only if not "all" category and not using other filters)
          if (category !== "all" && !hasActiveFilters(filters)) {
            params.append("category_ids", category);
          } else if (filters.categoryIds.length > 0) {
            params.append("category_ids", filters.categoryIds.join(","));
          }

          // Add author filter
          if (filters.authorIds.length > 0) {
            params.append("author_ids", filters.authorIds.join(","));
          }

          // Add publisher filter
          if (filters.publisherId) {
            params.append("publisher_id", filters.publisherId);
          }

          // Add reference only filter
          if (filters.isReferenceOnly === "true") {
            params.append("is_reference_only", "true");
          } else if (filters.isReferenceOnly === "false") {
            params.append("is_reference_only", "false");
          }
          // If "all", don't send the parameter - backend will return all books
        }

        const fullUrl = `${endpoint}?${params.toString()}`;
        const res = await fetch(fullUrl, { signal: abortController.signal });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        if (abortController.signal.aborted) return;

        if (category === "recommended") {
          const recommendedData = data as RecommendedResponse;
          setBooks(recommendedData.recommendeds?.map((r) => r.book_id) || []);
          setTotalBooks(recommendedData.total_count || 0);
        } else {
          const bookData = data as BookResponse;
          setBooks(bookData.books || []);
          setTotalBooks(bookData.total_count || 0);
        }
      } catch (err) {
        if (abortController.signal.aborted) return;
        console.error("Failed to fetch books:", err);
        setError(err instanceof Error ? err.message : "Failed to load books");
        setBooks([]);
        setTotalBooks(0);
      } finally {
        if (!abortController.signal.aborted) setLoading(false);
      }
    };

    fetchBooks();

    return () => {
      abortController.abort();
    };
  }, [category, filters, currentPage]);

  const hasActiveFilters = (filters: SearchFilters): boolean => {
    return (
      filters.search.trim() !== "" ||
      filters.categoryIds.length > 0 ||
      filters.authorIds.length > 0 ||
      filters.publisherId !== "" ||
      filters.isReferenceOnly !== "all"
    );
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      setCurrentPage(page);
      // Smooth scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];
    const delta = 2; // Number of pages to show on each side of current page
    
    // Previous button
    pages.push(
      <button
        key="prev"
        className="pagination-btn btn btn-outline-primary"
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        ← Prev
      </button>
    );

    // Calculate range of pages to show
    let rangeStart = Math.max(1, currentPage - delta);
    let rangeEnd = Math.min(totalPages, currentPage + delta);

    // Adjust range if we're near the beginning or end
    if (currentPage <= delta + 1) {
      rangeEnd = Math.min(totalPages, delta * 2 + 2);
    }
    if (currentPage >= totalPages - delta) {
      rangeStart = Math.max(1, totalPages - delta * 2 - 1);
    }

    // Always show page 1 if not in range
    if (rangeStart > 1) {
      pages.push(
        <button
          key={1}
          className={`pagination-btn btn ${
            1 === currentPage ? "btn-primary active" : "btn-outline-primary"
          }`}
          onClick={() => handlePageChange(1)}
        >
          1
        </button>
      );

      // Add ellipsis if there's a gap
      if (rangeStart > 2) {
        pages.push(
          <span key="ellipsis1" className="pagination-ellipsis">
            ...
          </span>
        );
      }
    }

    // Show pages in range
    for (let i = rangeStart; i <= rangeEnd; i++) {
      pages.push(
        <button
          key={i}
          className={`pagination-btn btn ${
            i === currentPage ? "btn-primary active" : "btn-outline-primary"
          }`}
          onClick={() => handlePageChange(i)}
        >
          {i}
        </button>
      );
    }

    // Always show last page if not in range
    if (rangeEnd < totalPages) {
      // Add ellipsis if there's a gap
      if (rangeEnd < totalPages - 1) {
        pages.push(
          <span key="ellipsis2" className="pagination-ellipsis">
            ...
          </span>
        );
      }

      pages.push(
        <button
          key={totalPages}
          className={`pagination-btn btn ${
            totalPages === currentPage ? "btn-primary active" : "btn-outline-primary"
          }`}
          onClick={() => handlePageChange(totalPages)}
        >
          {totalPages}
        </button>
      );
    }

    // Next button
    pages.push(
      <button
        key="next"
        className="pagination-btn btn btn-outline-primary"
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Next →
      </button>
    );

    return pages;
  };

  if (loading) {
    return (
      <div className="books-section">
        <div className="loading-container">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="books-section">
        <div className="container">
          <div className="alert alert-danger text-center">
            <h5 className="alert-heading">Error Loading Books</h5>
            <p className="mb-0">{error}</p>
            <hr />
            <button
              className="btn btn-outline-danger btn-sm"
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (books.length === 0) {
    const isSearchActive = hasActiveFilters(filters) || category === "all";
    return (
      <div className="books-section">
        <div className="no-results">
          <div className="no-results-icon">📚</div>
          <div className="no-results-title">
            {isSearchActive ? "No Books Found" : "No Books Available"}
          </div>
          <div className="no-results-text">
            {isSearchActive
              ? "Try adjusting your search terms or filters"
              : "There are no books in this category yet"}
          </div>
        </div>
      </div>
    );
  }

  const startIndex = (currentPage - 1) * booksPerPage + 1;
  const endIndex = Math.min(currentPage * booksPerPage, totalBooks);

  return (
    <div className="books-section">
      {/* Results info */}
      <div className="container">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="text-muted">
            Showing {startIndex}-{endIndex} of {totalBooks} books
          </div>
          <div className="text-muted">
            Page {currentPage} of {totalPages}
          </div>
        </div>

        {/* Books grid */}
        <div className="books-grid">
          {books.map((book) => (
            <BookCard 
              key={book.id} 
              book={book} 
              onClick={onBookClick}
            />
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination-container">
            {renderPagination()}
          </div>
        )}
      </div>
    </div>
  );
}

export default BookList;