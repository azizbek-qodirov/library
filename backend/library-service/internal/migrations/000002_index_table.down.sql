DROP INDEX IF EXISTS idx_categories_name;
DROP INDEX IF EXISTS idx_authors_name;
DROP INDEX IF EXISTS idx_users_full_name;
DROP INDEX IF EXISTS idx_books_isbn;
DROP INDEX IF EXISTS idx_books_title;

DROP INDEX IF EXISTS idx_book_categories_category_id;
DROP INDEX IF EXISTS idx_book_categories_book_id;
DROP INDEX IF EXISTS idx_books_publisher_id;

DROP INDEX IF EXISTS idx_borrowings_user_id;
DROP INDEX IF EXISTS idx_borrowings_book_id;
