-- The caller stages the edition manifest and the uploaded MinIO covers in this transaction.
DO $seed$
DECLARE
    manifest jsonb;
    covers jsonb;
    entry record;
    book jsonb;
    cover jsonb;
    record_id uuid;
    cover_id uuid;
    book_id uuid;
    category_key text;
    author_ids jsonb := '{}';
    publisher_ids jsonb := '{}';
    category_ids jsonb := '{}';
    book_number integer := 0;
BEGIN
    SELECT payload.manifest, payload.covers INTO STRICT manifest, covers FROM catalog_seed_payload payload;

    FOR entry IN SELECT key, value FROM jsonb_each(manifest->'authors') LOOP
        INSERT INTO authors (name, birth_date, biography)
        VALUES (entry.value->>'name', (entry.value->>'birth_date')::date, entry.value->>'description')
        RETURNING id INTO record_id;
        author_ids := author_ids || jsonb_build_object(entry.key, record_id);
    END LOOP;

    FOR entry IN SELECT key, value FROM jsonb_each(manifest->'publishers') LOOP
        INSERT INTO publishers (name, description)
        VALUES (entry.value->>'name', entry.value->>'description') RETURNING id INTO record_id;
        publisher_ids := publisher_ids || jsonb_build_object(entry.key, record_id);
    END LOOP;

    FOR entry IN SELECT key, value FROM jsonb_each(manifest->'categories') LOOP
        INSERT INTO categories (name, description)
        VALUES (entry.value->>'name', entry.value->>'description') RETURNING id INTO record_id;
        category_ids := category_ids || jsonb_build_object(entry.key, record_id);
    END LOOP;

    FOR book IN SELECT value FROM jsonb_array_elements(manifest->'books') LOOP
        cover := covers->(book->>'isbn');
        INSERT INTO files (url, mime_type, size, object_key)
        VALUES (cover->>'url', cover->>'mime_type', (cover->>'size')::bigint, cover->>'object_key')
        RETURNING id INTO cover_id;

        INSERT INTO books (title, cover_image_id, location, description, isbn, publication_year,
                           publisher_id, language, page_count, total_copies, available_copies)
        VALUES (book->>'title', cover_id, book->>'location', book->>'description', book->>'isbn',
                (book->>'publication_year')::integer, (publisher_ids->>(book->>'publisher'))::uuid,
                book->>'language', (book->>'pages')::integer, (book->>'copies')::integer, (book->>'copies')::integer)
        RETURNING id INTO book_id;

        INSERT INTO book_authors (book_id, author_id)
        VALUES (book_id, (author_ids->>(book->>'author'))::uuid);

        FOR category_key IN SELECT value FROM jsonb_array_elements_text(book->'categories') LOOP
            INSERT INTO book_categories (book_id, category_id)
            VALUES (book_id, (category_ids->>category_key)::uuid);
        END LOOP;

        book_number := book_number + 1;
        IF book_number <= 3 THEN
            INSERT INTO recommendeds (book_id) VALUES (book_id);
        END IF;
    END LOOP;
END
$seed$;
