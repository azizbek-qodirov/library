ALTER TABLE books ALTER COLUMN isbn DROP NOT NULL;

CREATE TABLE book_copies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
    barcode text GENERATED ALWAYS AS ('OX-' || number::text) STORED UNIQUE,
    retired boolean NOT NULL DEFAULT false,
    UNIQUE (book_id, id)
);
ALTER SEQUENCE book_copies_number_seq NO CYCLE;
CREATE INDEX book_copies_active_idx ON book_copies (book_id, number) WHERE NOT retired;

INSERT INTO book_copies (book_id)
SELECT b.id FROM books b CROSS JOIN LATERAL generate_series(1, b.total_copies)
ORDER BY b.id;

ALTER TABLE borrowings ADD COLUMN copy_id uuid;
ALTER TABLE borrowings ADD CONSTRAINT borrowings_copy_book_fk
    FOREIGN KEY (book_id, copy_id) REFERENCES book_copies (book_id, id);

-- Reserve one barcode for each open legacy loan. Completed loans predate copy identification.
WITH open_loans AS (
    SELECT id, book_id, row_number() OVER (PARTITION BY book_id ORDER BY from_date, id) AS position
    FROM borrowings WHERE status IN ('borrowed', 'lost')
), copies AS (
    SELECT id, book_id, row_number() OVER (PARTITION BY book_id ORDER BY number) AS position
    FROM book_copies
)
UPDATE borrowings l SET copy_id = c.id
FROM open_loans o JOIN copies c USING (book_id, position)
WHERE l.id = o.id;

CREATE UNIQUE INDEX borrowings_open_copy_idx
    ON borrowings (copy_id) WHERE status IN ('borrowed', 'lost') AND copy_id IS NOT NULL;

CREATE FUNCTION sync_book_copies() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    previous_total integer := 0;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        previous_total := OLD.total_copies;
    END IF;

    IF NEW.total_copies > previous_total THEN
        INSERT INTO book_copies (book_id)
        SELECT NEW.id FROM generate_series(1, NEW.total_copies - previous_total);
    ELSIF NEW.total_copies < previous_total THEN
        UPDATE book_copies SET retired = true
        WHERE id IN (
            SELECT c.id FROM book_copies c
            WHERE c.book_id = NEW.id AND NOT c.retired
              AND NOT EXISTS (
                  SELECT 1 FROM borrowings l
                  WHERE l.copy_id = c.id AND l.status IN ('borrowed', 'lost')
              )
            ORDER BY c.number DESC
            LIMIT (previous_total - NEW.total_copies)
        );
        IF NOT FOUND OR (SELECT count(*) FROM book_copies WHERE book_id = NEW.id AND NOT retired) <> NEW.total_copies THEN
            RAISE EXCEPTION 'cannot retire copies with open loans' USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER books_sync_copies AFTER INSERT OR UPDATE OF total_copies ON books
FOR EACH ROW EXECUTE FUNCTION sync_book_copies();
