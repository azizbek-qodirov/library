"""Verify the Compose stack after running the demo seed."""
import base64
import hashlib
import json
import os
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

base = os.environ.get("SMOKE_URL", "http://127.0.0.1:8080")
manifest = Path(__file__).resolve().parents[1] / "backend/api-gateway/cmd/libraryctl/catalog/books.json"
expected = {book["isbn"]: book for book in json.loads(manifest.read_text())["books"]}


def get(path, staff=False):
    headers = {}
    if staff:
        credentials = f"{os.environ['STAFF_USERNAME']}:{os.environ['STAFF_PASSWORD']}"
        headers["Authorization"] = "Basic " + base64.b64encode(credentials.encode()).decode()
    return urlopen(Request(urljoin(base, path), headers=headers), timeout=10)


class ModuleScripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script" and attrs.get("type") == "module" and "src" in attrs:
            self.urls.append(attrs["src"])


for path in ("/", "/librarian/"):
    with get(path) as response:
        parser = ModuleScripts()
        parser.feed(response.read().decode())
    assert parser.urls, path
    for script in parser.urls:
        with get(urljoin(path, script)) as response:
            assert response.headers.get_content_type() in ("application/javascript", "text/javascript"), script
for path in ("/healthz", "/api/swagger/index.html"):
    with get(path) as response:
        assert response.status == 200, path

with get("/api/staff/session", staff=True) as response:
    assert response.status == 204
try:
    with get("/api/users"):
        raise AssertionError("anonymous request could read borrower records")
except HTTPError as exc:
    assert exc.code == 401

for path in ("/api/users", "/api/borrowings"):
    with get(path, staff=True) as response:
        payload = json.load(response)
        assert not payload.get("total") and not payload.get("total_count"), path
with get("/api/books?limit=20") as response:
    page = json.load(response)
assert page["total_count"] == len(expected)
assert set(expected) == {b["isbn"] for b in page["books"]}
for book in page["books"]:
    edition = expected[book["isbn"]]
    assert book["publication_year"] == edition["publication_year"]
    assert book["page_count"] == edition["pages"] and book["language"] == "uzb"
    assert book["author_ids"] and book["publisher_id"] and book["category_ids"]
    assert book["available_copies"] == edition["copies"]
    cover = book["cover_image_id"]["url"]
    assert cover.startswith("/covers/"), cover
    with get(cover) as response:
        assert response.headers.get_content_type() == book["cover_image_id"]["mime_type"]
        assert hashlib.sha256(response.read()).hexdigest() == edition["sha256"]
print(f"Catalog, staff auth, and {len(expected)} proxied edition covers verified")
