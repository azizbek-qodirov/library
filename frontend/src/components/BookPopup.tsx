import { useEffect, useId, useRef, useState } from "react";
import type { Book } from "./types";

interface Props {
  book: Book;
  onClose: () => void;
}

function BookPopup({ book, onClose }: Props) {
  const available = (book.available_copies ?? 0) > 0;

  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [coverError, setCoverError] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); onClose(); }}
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
              {book.cover_image_id?.url && !coverError ? (
                <img
                  src={book.cover_image_id.url}
                  alt={book.title}
                  className="book-popup-image"
                  onError={() => setCoverError(true)}
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
              <h2 className="book-popup-title" id={titleId}>{book.title}</h2>

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
              {(book.published_date || book.publication_year) && (
                <div className="book-detail-item">
                  <strong>Published:</strong>
                  <span className="ms-2">
                    {book.published_date ? new Date(book.published_date).toLocaleDateString(undefined, { timeZone: 'UTC' }) : book.publication_year}
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
    </dialog>
  );
}

export default BookPopup;