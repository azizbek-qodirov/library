CREATE TABLE library_setup (
    key text PRIMARY KEY,
    initialized_at timestamptz NOT NULL DEFAULT now()
);
