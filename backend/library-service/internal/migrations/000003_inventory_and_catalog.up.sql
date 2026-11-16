ALTER TABLE books ALTER COLUMN published_date DROP NOT NULL;

ALTER TABLE book_authors DROP CONSTRAINT book_authors_book_id_fkey;
ALTER TABLE book_authors ADD CONSTRAINT book_authors_book_id_fkey
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;

-- Reconcile the manually maintained counters against outstanding loan records.
WITH outstanding AS (
    SELECT book_id, count(*)::integer AS copies
    FROM borrowings
    WHERE status IN ('borrowed', 'lost')
    GROUP BY book_id
), inventory AS (
    SELECT b.id, greatest(b.total_copies, 0, coalesce(o.copies, 0)) AS total,
           coalesce(o.copies, 0) AS outstanding
    FROM books b LEFT JOIN outstanding o ON o.book_id = b.id
)
UPDATE books b
SET total_copies = i.total, available_copies = i.total - i.outstanding
FROM inventory i WHERE i.id = b.id;

ALTER TABLE books ADD CONSTRAINT books_copy_counts_valid
    CHECK (available_copies BETWEEN 0 AND total_copies);

CREATE INDEX idx_books_title_id ON books(title, id);
CREATE INDEX idx_book_authors_author_id ON book_authors(author_id, book_id);
CREATE INDEX idx_borrowings_created_id ON borrowings(created_at DESC, id);
CREATE INDEX idx_recommendeds_created_id ON recommendeds(created_at DESC, id);
