import { useState } from "react";
import type { Book } from "./types";

interface Props {
  book: Book;
  onClick?: (book: Book) => void;
}

function BookCard({ book, onClick }: Props) {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  
  const available = (book.available_copies ?? 0) > 0;

  const handleClick = () => {
    if (onClick) {
      onClick(book);
    }
  };

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  const handleImageError = () => {
    setImageLoading(false);
    setImageError(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick(book);
    }
  };

  return (
    <div
      className="book-card"
      onClick={handleClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={handleKeyDown}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="book-image-container">
        {book.cover_image_id?.url && !imageError ? (
          <>
            <img
              src={book.cover_image_id.url}
              alt={book.title}
              className={`book-image ${imageLoading ? 'loading' : ''}`}
              onLoad={handleImageLoad}
              onError={handleImageError}
              loading="lazy"
            />
            {imageLoading && (
              <div className="image-placeholder">
                <div className="spinner-border spinner-border-sm text-muted" role="status">
                  <span className="visually-hidden">Yuklanmoqda...</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="image-placeholder">
            <div className="text-center">
              <i className="bi bi-book" style={{ fontSize: '2rem', color: '#6c757d' }}>📖</i>
              <div className="mt-1 small">Muqova yo'q</div>
            </div>
          </div>
        )}
        
        {/* Availability badge */}
        <div className={`availability-badge ${available ? 'available' : 'unavailable'}`}>
          {available ? '✓' : '✗'}
        </div>
      </div>

      <div className="book-info">
        <h6 className="book-title" title={book.title}>
          {book.title}
        </h6>

        {book.author_ids && book.author_ids.length > 0 && (
          <div className="book-author" title={book.author_ids.map(a => a.name).join(', ')}>
            <strong>By:</strong> {book.author_ids.map(a => a.name).join(', ')}
          </div>
        )}

        {book.publisher_id && (
          <div className="book-publisher" title={book.publisher_id.name}>
            <strong>Publisher:</strong> {book.publisher_id.name}
          </div>
        )}

        <div className="d-flex justify-content-between align-items-center mt-2">
          {book.page_count && (
            <small className="text-muted">{book.page_count}p</small>
          )}
        </div>

        {/* Additional info */}
        <div className="mt-2">
          {available && book.available_copies && book.total_copies && (
            <small className="text-muted d-block">
              {book.available_copies}/{book.total_copies} copies
            </small>
          )}
          
          {book.location && (
            <small className="text-muted d-block">
              <strong>Location:</strong> {book.location}
            </small>
          )}
          
          {book.is_reference_only && (
            <span className="reference-badge">Reference Only</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default BookCard;