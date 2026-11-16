DROP TRIGGER book_cover_must_be_ready ON books;
DROP FUNCTION require_ready_book_cover();
ALTER TABLE files DROP COLUMN state, DROP COLUMN object_key;
