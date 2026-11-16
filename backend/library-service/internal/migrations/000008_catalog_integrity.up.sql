DELETE FROM recommendeds
WHERE id IN (
    SELECT id FROM (
        SELECT id, row_number() OVER (PARTITION BY book_id ORDER BY created_at DESC NULLS LAST, id) AS position
        FROM recommendeds
    ) ranked
    WHERE position > 1
);
ALTER TABLE recommendeds ADD CONSTRAINT recommendeds_book_id_unique UNIQUE (book_id);

ALTER TABLE borrowings ADD COLUMN checkout_payload jsonb;
UPDATE borrowings SET checkout_payload = jsonb_build_array(book_id, user_id, from_date, due_date, coalesce(notes, ''))
WHERE request_id IS NOT NULL;
