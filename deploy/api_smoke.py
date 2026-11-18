"""Exercise the library HTTP API against a disposable seeded stack."""
import base64
import json
import os
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from uuid import uuid4

base = os.environ.get("SMOKE_URL", "http://127.0.0.1:8080").rstrip("/")
credentials = f"{os.environ['STAFF_USERNAME']}:{os.environ['STAFF_PASSWORD']}"
authorization = "Basic " + base64.b64encode(credentials.encode()).decode()
marker = "API fixture " + uuid4().hex[:12]


def request(path, method="GET", data=None, expected=200, staff=True, content_type=None):
    headers = {"Authorization": authorization} if staff else {}
    if isinstance(data, dict):
        data = json.dumps(data).encode()
        content_type = "application/json"
    if content_type:
        headers["Content-Type"] = content_type
    req = Request(base + path, headers=headers, data=data, method=method)
    try:
        response = urlopen(req, timeout=15)
    except HTTPError as err:
        response = err
    with response:
        body = response.read()
        assert response.status == expected, (method, path, expected, response.status, body)
        if body and response.headers.get_content_type() == "application/json":
            return json.loads(body)
        return body


def api(path, *args, **kwargs):
    return request("/api" + path, *args, **kwargs)


def listed(path, key, **query):
    return api(path + "?" + urlencode(query)).get(key, [])


def create_and_find(route, plural, data, alias=None):
    created = api("/" + route, "POST", data, 201)
    matches = listed("/" + plural, alias or plural, search=marker, limit=10)
    assert len(matches) == 1, (route, matches)
    if route in ("author", "publisher", "category"):
        assert created[route]["id"] == matches[0]["id"]
        assert created[route]["name"] == data["name"]
    return matches[0]["id"]


for path in ("authors", "books", "borrowings", "categories", "files", "publishers", "recommended", "users"):
    api(f"/{path}?offset=nan", expected=400)
    api(f"/{path}?limit=0", expected=400)
    api(f"/{path}?limit=101", expected=400)
    api(f"/{path}?offset=-1", expected=400)
for path in ("/authors?order_by=invalid", "/categories?sort=invalid", "/publishers?order_by=invalid",
             "/borrowings?status=invalid", "/borrowings?from_date=2026-02-30",
             "/books?available_only=invalid", "/books?is_reference_only=invalid",
             "/books?author_ids=invalid", "/book/invalid"):
    api(path, expected=400)
api("/book/" + str(uuid4()), expected=404)
api("/user", "POST", {"full_name": marker, "role": "librarian"}, expected=400)
api("/user", "POST", {"full_name": marker, "role": "student", "email": "invalid"}, expected=400)
api("/book", "POST", {"title": marker, "isbn": "123", "page_count": 42}, expected=400)
api("/book", "POST", {"title": marker}, expected=401, staff=False)

assert listed("/books", "books", search="O'tkan kunlar")[0]["isbn"] == "9789943273573"
assert listed("/books", "books", search="978-9943-27-357-3")[0]["isbn"] == "9789943273573"
assert listed("/recommended", "recommendeds", search="O'tkan kunlar")[0]["book_id"]["isbn"] == "9789943273573"
assert listed("/authors", "authors", search="G'afur G'ulom")[0]["name"] == "G‘afur G‘ulom"

user = create_and_find("user", "users", {"full_name": marker, "role": "StuDenT"})
api(f"/user/{user}", "PUT", {"role": "teacher"}, expected=400)
api(f"/user/{user}", "PUT", {"full_name": marker, "role": "teacher", "group_name": "T1", "phone": "+998 (90) 123-45-67"})
assert api(f"/user/{user}")["phone"] == "+998901234567"
assert [found["id"] for found in listed("/users", "users", search=marker, role="TEACHER", group_name="t1")] == [user]
api(f"/user/{user}", expected=401, staff=False)

author = create_and_find("author", "authors", {"name": marker})
api(f"/author/{author}", "PUT", {"name": marker, "birth_date": "1980-01-01", "biography": "Updated biography"})
assert api(f"/author/{author}")["birth_date"] == "1980-01-01"
assert api(f"/author/{author}")["biography"] == "Updated biography"
assert listed("/authors", "authors", search=marker, order_by="birth_date")[0]["id"] == author

publisher = create_and_find("publisher", "publishers", {"name": marker})
api(f"/publisher/{publisher}", "PUT", {"name": marker, "description": "Updated publisher"})
assert api(f"/publisher/{publisher}")["description"] == "Updated publisher"
assert listed("/publishers", "publishers", search=marker, order_by="name")[0]["id"] == publisher

category = create_and_find("category", "categories", {"name": marker})
api(f"/category/{category}", "PUT", {"name": marker, "description": "Updated category"})
assert api(f"/category/{category}")["description"] == "Updated category"

png = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2NsAAAAASUVORK5CYII=")
boundary = "library-api-smoke"
multipart = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="cover.png"\r\n'
             'Content-Type: application/octet-stream\r\n\r\n').encode()
tail = f"\r\n--{boundary}--\r\n".encode()


def upload(data, expected):
    return api("/file", "POST", multipart + data + tail, expected,
               content_type=f"multipart/form-data; boundary={boundary}")


upload(b"not an image", 400)
cover = upload(png, 201)
cover_id = cover["id"]
assert api(f"/file/{cover_id}")["mime_type"] == "image/png"
assert cover_id in {item["id"] for item in listed("/files", "files", mime_type="image/png")}
assert request(cover["url"], staff=False) == png

book_data = {
    "title": marker, "isbn": "9780306406157", "page_count": 42, "total_copies": 1,
    "publication_year": 2025, "language": "uzb", "location": marker,
    "author_ids": [author], "publisher_id": publisher, "category_ids": [category], "cover_image_id": cover_id,
}
api("/book", "POST", {**book_data, "publication_year": -1}, 400)
api("/book", "POST", {**book_data, "published_date": "2024-02-01"}, 400)
book = create_and_find("book", "books", book_data)
assert api(f"/book/{book}")["publication_year"] == 2025
api(f"/book/{book}", "PUT", {**book_data, "publication_year": 2026, "is_reference_only": True})
assert api(f"/book/{book}")["publication_year"] == 2026
assert not listed("/books", "books", search=marker, available_only="true")
assert len(listed("/books", "books", search=marker, author_ids=author, publisher_id=publisher,
                  category_ids=category, language="uzb", location=marker, is_reference_only="true")) == 1
api(f"/file/{cover_id}", "DELETE", expected=409)
api(f"/book/{book}", "PUT", book_data)
assert len(listed("/books", "books", search=marker, available_only="true")) == 1
assert not listed("/books", "books", search=marker, offset=1)
assert listed("/categories", "categories", search=marker, sort="book_count")[0]["book_count"] == 1

api("/recommended", "POST", {"book_id": book}, 201)
api("/recommended", "POST", {"book_id": book}, 409)
recs = listed("/recommended", "recommendeds", search=marker)
assert len(recs) == 1 and api(f"/recommended/{recs[0]['id']}")["book_id"]["id"] == book
api(f"/recommended/{recs[0]['id']}", "DELETE")

checkout = {"book_id": book, "user_id": user, "from_date": "2026-01-01",
            "due_date": "2026-01-10", "request_id": str(uuid4()), "notes": "Original note"}
api("/borrowing", "POST", {**checkout, "due_date": "2025-12-31"}, 400)
api("/borrowing", "POST", checkout, 201)
api("/borrowing", "POST", {**checkout, "request_id": str(uuid4())}, 409)
loans = listed("/borrowings", "borrowings", search=marker, status="BORROWED",
               from_date="2026-01-01", due_date="2026-01-31")
assert len(loans) == 1
loan = loans[0]["id"]
assert not api(f"/book/{book}").get("available_copies")
api(f"/borrowing/{loan}", "DELETE", expected=409)
api(f"/book/{book}", "DELETE", expected=409)
api(f"/user/{user}", "DELETE", expected=409)
api(f"/borrowing/{loan}", "PUT", {"from_date": "2026-01-01", "due_date": "2026-01-11",
                                 "status": "borrowed", "notes": "Edited note"})
api("/borrowing", "POST", checkout, 201)
api("/borrowing", "POST", {**checkout, "notes": "Different checkout"}, 409)
api(f"/borrowing/{loan}/renew", "POST", {"extension_date": "2026-01-20"}, 204)
api(f"/borrowing/{loan}/renew", "POST", {"extension_date": "2026-01-19"}, 409)
assert api(f"/borrowing/{loan}")["extension_date"] == "2026-01-20"
api(f"/borrowing/{loan}/lost", "POST", expected=204)
assert api(f"/borrowing/{loan}")["status"] == "lost"
assert not api(f"/book/{book}").get("available_copies")
api(f"/borrowing/{loan}/return", "POST", expected=204)
api(f"/borrowing/{loan}/return", "POST", expected=204)
assert api(f"/borrowing/{loan}")["status"] == "returned"
assert api(f"/book/{book}")["available_copies"] == 1

# Scan an individual copy of an ISBN-less title, while another copy remains available.
barcode_title = marker + " without ISBN"
barcode_book_data = {"title": barcode_title, "page_count": 42, "total_copies": 2}
api("/book", "POST", barcode_book_data, 201)
barcode_book, = [item for item in listed("/books", "books", search=barcode_title)]
assert not barcode_book.get("isbn")
barcode_book_id = barcode_book["id"]
first, second = api(f"/book/{barcode_book_id}/copies")["copies"]
assert first["barcode"] != second["barcode"]
barcode = second["barcode"]
lookup = f"/copy/{barcode.lower()}"
api(lookup, expected=401, staff=False)
assert api(lookup)["book"]["id"] == barcode_book_id
assert api(lookup)["copy"] == second
public_books = api("/books?" + urlencode({"search": barcode}), staff=False)["books"]
assert [item["id"] for item in public_books] == [barcode_book_id]

copy_checkout = {**checkout, "book_id": barcode_book_id, "copy_id": second["id"], "request_id": str(uuid4())}
api("/borrowing", "POST", {**copy_checkout, "copy_id": api(f"/book/{book}/copies")["copies"][0]["id"]}, 409)
api("/borrowing", "POST", copy_checkout, 201)
api("/borrowing", "POST", copy_checkout, 201)
assert api(lookup)["copy"]["status"] == "borrowed"
assert api(f"/book/{barcode_book_id}")["available_copies"] == 1
api("/borrowing", "POST", {**copy_checkout, "request_id": str(uuid4())}, 409)
barcode_loan, = listed("/borrowings", "borrowings", search=barcode)
assert barcode_loan["copy"]["id"] == second["id"]
api(f"/borrowing/{barcode_loan['id']}/return", "POST", expected=204)
assert api(lookup)["copy"]["status"] == "available"
api(f"/book/{barcode_book_id}", "PUT", {**barcode_book_data, "total_copies": 1})
assert api(lookup)["copy"]["status"] == "retired"
api(f"/book/{barcode_book_id}", "PUT", barcode_book_data)
assert len({copy["barcode"] for copy in api(f"/book/{barcode_book_id}/copies")["copies"]}) == 3

for route, identifier in (("borrowing", barcode_loan["id"]), ("book", barcode_book_id),
                          ("borrowing", loan), ("book", book), ("author", author),
                          ("publisher", publisher), ("category", category), ("user", user),
                          ("file", cover_id)):
    api(f"/{route}/{identifier}", "DELETE")
    api(f"/{route}/{identifier}", expected=404)
request(cover["url"], expected=404, staff=False)
print("Verified catalog CRUD, search and filters, recommendation uniqueness, checkout, renewal, loss, return, copy barcode lifecycle, and cover lifecycle")
