DROP INDEX idx_recommendeds_created_id;
DROP INDEX idx_borrowings_created_id;
DROP INDEX idx_book_authors_author_id;
DROP INDEX idx_books_title_id;
ALTER TABLE books DROP CONSTRAINT books_copy_counts_valid;

ALTER TABLE book_authors DROP CONSTRAINT book_authors_book_id_fkey;
ALTER TABLE book_authors ADD CONSTRAINT book_authors_book_id_fkey
    FOREIGN KEY (book_id) REFERENCES books(id);

-- This fails safely if books with an unknown publication date now exist.
ALTER TABLE books ALTER COLUMN published_date SET NOT NULL;
