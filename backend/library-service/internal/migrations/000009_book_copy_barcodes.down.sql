-- Rollback requires assigning an ISBN to every book created without one.
ALTER TABLE books ALTER COLUMN isbn SET NOT NULL;
DROP TRIGGER books_sync_copies ON books;
DROP FUNCTION sync_book_copies();
ALTER TABLE borrowings DROP COLUMN copy_id;
DROP TABLE book_copies;
