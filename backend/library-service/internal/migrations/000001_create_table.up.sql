-- Create enums
DO $$ 
BEGIN IF NOT EXISTS (
    SELECT 1 FROM pg_type
    WHERE typname = 'role_type'
) THEN CREATE TYPE role_type AS ENUM ('student', 'teacher');
END IF;

IF NOT EXISTS (
    SELECT 1 FROM pg_type 
    WHERE typname = 'borrowing_status_type'
) THEN CREATE TYPE borrowing_status_type AS ENUM ('borrowed', 'returned', 'lost');
END IF;

END $$;

-- Publishers table
CREATE TABLE publishers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(256) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Categories table
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(256) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Files table
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL,
    mime_type VARCHAR(50),
    size BIGINT,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- Books table
CREATE TABLE books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(256) NOT NULL,
    cover_image_id UUID DEFAULT NULL,
    location VARCHAR(256),
    is_reference_only BOOLEAN DEFAULT FALSE,
    description TEXT,
    isbn TEXT UNIQUE NOT NULL,
    published_date TIMESTAMP NOT NULL,
    publisher_id UUID DEFAULT NULL,
    language VARCHAR(3),
    page_count INT,
    total_copies INT NOT NULL DEFAULT 0,
    available_copies INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP,
    FOREIGN KEY (cover_image_id) REFERENCES files(id),
    FOREIGN KEY (publisher_id) REFERENCES publishers(id)
);

-- Book categories
CREATE TABLE book_categories (
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (book_id, category_id)
);

-- Authors table
CREATE TABLE authors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(256) NOT NULL,
    birth_date DATE,
    biography TEXT
);

-- BookAuthors table (many-to-many)
CREATE TABLE book_authors (
    book_id UUID NOT NULL,
    author_id UUID NOT NULL,
    PRIMARY KEY (book_id, author_id),
    FOREIGN KEY (book_id) REFERENCES books(id),
    FOREIGN KEY (author_id) REFERENCES authors(id)
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(256) NOT NULL,
    group_name VARCHAR(256),
    email VARCHAR(256),
    phone VARCHAR(20),
    role role_type NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);

-- Borrowings table
CREATE TABLE borrowings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL,
    user_id UUID NOT NULL,
    from_date DATE NOT NULL,
    due_date DATE NOT NULL,
    extension_date DATE,
    status borrowing_status_type NOT NULL DEFAULT 'borrowed',
    returned_at DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Recommendeds table
CREATE TABLE recommendeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);