ALTER TABLE books ADD COLUMN publication_year integer CHECK (publication_year BETWEEN 1 AND 9999);
