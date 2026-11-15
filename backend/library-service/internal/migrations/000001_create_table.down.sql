-- Drop tables in reverse order of dependencies

DROP TABLE IF EXISTS recommendeds;
DROP TABLE IF EXISTS borrowings;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS book_authors;
DROP TABLE IF EXISTS authors;
DROP TABLE IF EXISTS book_categories;
DROP TABLE IF EXISTS books;
DROP TABLE IF EXISTS files;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS publishers;

-- Drop enums
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'borrowing_status_type') THEN
        DROP TYPE borrowing_status_type;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_type') THEN
        DROP TYPE role_type;
    END IF;
END $$;