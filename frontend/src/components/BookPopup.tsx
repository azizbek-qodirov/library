import { useI18n } from '../../../shared/i18n';
import { Icon } from '../../../shared/Icon';
import { useEffect, useId, useRef, useState } from "react";
import type { Book } from "./types";

interface Props {
  book: Book;
  onClose: () => void;
}

function BookPopup({ book, onClose }: Props) {
  const { locale, t } = useI18n();
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
          aria-label={t("Close popup")}
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
                  <i className="bi bi-book" style={{ fontSize: '4rem', color: '#6c757d' }}><Icon name="book" size={28} /></i>
                  <div className="mt-2">{t("No Cover Available")}</div>
                </div>
              )}
              
              {/* Availability badge */}
              <div className={`book-popup-badge ${available ? 'available' : 'unavailable'}`}>
                {available ? t("✓ Available") : t("✗ Not Available")}
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
                  <strong>{t(book.author_ids.length > 1 ? "Authors" : "Author")}:</strong>
                  <span className="ms-2">
                    {book.author_ids.map(author => author.name).join(', ')}
                  </span>
                </div>
              )}

              {/* Publisher */}
              {book.publisher_id && (
                <div className="book-detail-item">
                  <strong>{t("Publisher:")}</strong>
                  <span className="ms-2">{book.publisher_id.name}</span>
                </div>
              )}

              {/* Categories */}
              {book.category_ids && book.category_ids.length > 0 && (
                <div className="book-detail-item">
                  <strong>{t("Categories:")}</strong>
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
                  <strong>{t("ISBN:")}</strong>
                  <span className="ms-2">{book.isbn}</span>
                </div>
              )}

              {/* Published Date */}
              {(book.published_date || book.publication_year) && (
                <div className="book-detail-item">
                  <strong>{t("Published:")}</strong>
                  <span className="ms-2">
                    {book.published_date ? new Date(book.published_date).toLocaleDateString(locale, { timeZone: 'UTC' }) : book.publication_year}
                  </span>
                </div>
              )}

              {/* Language */}
              {book.language && (
                <div className="book-detail-item">
                  <strong>{t("Language:")}</strong>
                  <span className="ms-2">{book.language}</span>
                </div>
              )}

              {/* Page Count */}
              {book.page_count && (
                <div className="book-detail-item">
                  <strong>{t("Pages:")}</strong>
                  <span className="ms-2">{book.page_count}</span>
                </div>
              )}

              {/* Location */}
              {book.location && (
                <div className="book-detail-item">
                  <strong>{t("Location:")}</strong>
                  <span className="ms-2">{book.location}</span>
                </div>
              )}

              {/* Copies Information */}
              {book.total_copies && (
                <div className="book-detail-item">
                  <strong>{t("Copies:")}</strong>
                  <span className="ms-2">
                    {t("{available} available out of {total}", { available: book.available_copies ?? 0, total: book.total_copies })}
                  </span>
                </div>
              )}

              {/* Reference Only */}
              {book.is_reference_only && (
                <div className="book-detail-item">
                  <span className="badge bg-warning text-dark">
                    {t("For in-library use only")}
                  </span>
                </div>
              )}

              {/* Description */}
              {book.description && (
                <div className="book-detail-item mt-3">
                  <strong>{t("Description:")}</strong>
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