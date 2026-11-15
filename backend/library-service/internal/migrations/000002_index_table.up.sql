
CREATE INDEX idx_books_publisher_id ON books(publisher_id);
CREATE INDEX idx_book_categories_book_id ON book_categories(book_id);
CREATE INDEX idx_book_categories_category_id ON book_categories(category_id);

CREATE INDEX idx_borrowings_book_id ON borrowings(book_id);
CREATE INDEX idx_borrowings_user_id ON borrowings(user_id);

-- For search
CREATE INDEX idx_books_title ON books(title);
CREATE INDEX idx_books_isbn ON books(isbn);
CREATE INDEX idx_users_full_name ON users(full_name);
CREATE INDEX idx_authors_name ON authors(name);
CREATE INDEX idx_categories_name ON categories(name);
