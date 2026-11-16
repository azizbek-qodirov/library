package main

import "testing"

func TestDemoCatalog(t *testing.T) {
	catalog, covers, err := loadCatalog()
	if err != nil {
		t.Fatal(err)
	}
	isbns := make(map[string]bool, len(catalog.Books))
	for i, book := range catalog.Books {
		if isbns[book.ISBN] {
			t.Fatalf("duplicate ISBN %s", book.ISBN)
		}
		isbns[book.ISBN] = true
		sum := 0
		for pos, digit := range book.ISBN {
			if digit < '0' || digit > '9' {
				t.Fatalf("non-numeric ISBN %s", book.ISBN)
			}
			sum += int(digit-'0') * (1 + 2*(pos%2))
		}
		if sum%10 != 0 {
			t.Fatalf("invalid ISBN checksum for %s", book.ISBN)
		}
		if len(covers[i].data) > 5<<20 {
			t.Fatalf("cover exceeds upload limit for %s", book.Title)
		}
	}
}
