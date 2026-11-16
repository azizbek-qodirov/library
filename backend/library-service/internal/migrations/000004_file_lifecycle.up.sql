ALTER TABLE files
    ADD COLUMN object_key text NOT NULL DEFAULT '',
    ADD COLUMN state text NOT NULL DEFAULT 'ready'
        CHECK (state IN ('pending_upload', 'ready', 'deleting'));

CREATE FUNCTION require_ready_book_cover() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.cover_image_id IS NOT NULL THEN
        PERFORM 1 FROM files WHERE id = NEW.cover_image_id AND state = 'ready' FOR SHARE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'cover file is unavailable' USING ERRCODE = '23503';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER book_cover_must_be_ready BEFORE INSERT OR UPDATE OF cover_image_id ON books
FOR EACH ROW EXECUTE FUNCTION require_ready_book_cover();
