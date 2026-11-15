import { useEffect } from "react";
import type { Book } from "./types";

interface Props {
  book: Book;
  onClose: () => void;
}

function BookPopup({ book, onClose }: Props) {
  const available = (book.available_copies ?? 0) > 0;

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Prevent body scroll when popup is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const img = e.target as HTMLImageElement;
    img.style.display = 'none';
  };

  return (
    <div 
      className="book-popup-overlay"
      onClick={handleOverlayClick}
    >
      <div className="book-popup-content">
        {/* Close button */}
        <button
          className="book-popup-close btn btn-outline-secondary"
          onClick={onClose}
          aria-label="Close popup"
        >
          ✕
        </button>

        <div className="row g-4">
          {/* Book Cover */}
          <div className="col-md-4">
            <div className="book-popup-image-container">
              {book.cover_image_id?.url ? (
                <img
                  src={book.cover_image_id.url}
                  alt={book.title}
                  className="book-popup-image"
                  onError={handleImageError}
                />
              ) : (
                <div className="book-popup-placeholder">
                  <i className="bi bi-book" style={{ fontSize: '4rem', color: '#6c757d' }}>📖</i>
                  <div className="mt-2">No Cover Available</div>
                </div>
              )}
              
              {/* Availability badge */}
              <div className={`book-popup-badge ${available ? 'available' : 'unavailable'}`}>
                {available ? '✓ Available' : '✗ Not Available'}
              </div>
            </div>
          </div>

          {/* Book Details */}
          <div className="col-md-8">
            <div className="book-popup-details">
              {/* Title */}
              <h2 className="book-popup-title">{book.title}</h2>

              {/* Authors */}
              {book.author_ids && book.author_ids.length > 0 && (
                <div className="book-detail-item">
                  <strong>Author{book.author_ids.length > 1 ? 's' : ''}:</strong>
                  <span className="ms-2">
                    {book.author_ids.map(author => author.name).join(', ')}
                  </span>
                </div>
              )}

              {/* Publisher */}
              {book.publisher_id && (
                <div className="book-detail-item">
                  <strong>Publisher:</strong>
                  <span className="ms-2">{book.publisher_id.name}</span>
                </div>
              )}

              {/* Categories */}
              {book.category_ids && book.category_ids.length > 0 && (
                <div className="book-detail-item">
                  <strong>Categories:</strong>
                  <div className="mt-1">
                    {book.category_ids.map(category => (
                      <span key={category.id} className="badge bg-primary me-1 mb-1">
                        {category.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ISBN */}
              {book.isbn && (
                <div className="book-detail-item">
                  <strong>ISBN:</strong>
                  <span className="ms-2">{book.isbn}</span>
                </div>
              )}

              {/* Published Date */}
              {book.published_date && (
                <div className="book-detail-item">
                  <strong>Published:</strong>
                  <span className="ms-2">
                    {new Date(book.published_date).toLocaleDateString()}
                  </span>
                </div>
              )}

              {/* Language */}
              {book.language && (
                <div className="book-detail-item">
                  <strong>Language:</strong>
                  <span className="ms-2">{book.language}</span>
                </div>
              )}

              {/* Page Count */}
              {book.page_count && (
                <div className="book-detail-item">
                  <strong>Pages:</strong>
                  <span className="ms-2">{book.page_count}</span>
                </div>
              )}

              {/* Location */}
              {book.location && (
                <div className="book-detail-item">
                  <strong>Location:</strong>
                  <span className="ms-2">{book.location}</span>
                </div>
              )}

              {/* Copies Information */}
              {book.total_copies && (
                <div className="book-detail-item">
                  <strong>Copies:</strong>
                  <span className="ms-2">
                    {book.available_copies || 0} available out of {book.total_copies} total
                  </span>
                </div>
              )}

              {/* Reference Only */}
              {book.is_reference_only && (
                <div className="book-detail-item">
                  <span className="badge bg-warning text-dark">
                    📚 Reference Only - Cannot be borrowed
                  </span>
                </div>
              )}

              {/* Description */}
              {book.description && (
                <div className="book-detail-item mt-3">
                  <strong>Description:</strong>
                  <p className="mt-2 text-muted">{book.description}</p>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BookPopup;