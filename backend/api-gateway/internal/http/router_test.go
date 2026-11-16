package api

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"library-gateway/internal/http/handlers"
	"library-gateway/internal/pkg/config"
)

func TestStaffRoutes(t *testing.T) {
	cfg := &config.Config{
		STAFF_USERNAME:       "librarian",
		STAFF_PASSWORD:       "test-only",
		CORS_ALLOWED_ORIGINS: "http://localhost:5174",
	}
	router := NewRouter(&handlers.HTTPHandler{}, nil, cfg)

	for _, route := range []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/users"},
		{http.MethodGet, "/user/example"},
		{http.MethodGet, "/borrowings"},
		{http.MethodPost, "/borrowing/example/return"},
		{http.MethodPost, "/borrowing/example/renew"},
		{http.MethodPost, "/borrowing/example/lost"},
		{http.MethodPost, "/book"},
		{http.MethodPut, "/author/example"},
		{http.MethodDelete, "/recommended/example"},
		{http.MethodGet, "/files"},
		{http.MethodPost, "/file"},
	} {
		t.Run(route.method+route.path, func(t *testing.T) {
			result := httptest.NewRecorder()
			router.ServeHTTP(result, httptest.NewRequest(route.method, route.path, nil))
			if result.Code != http.StatusUnauthorized {
				t.Fatalf("anonymous request got %d, want 401", result.Code)
			}
		})
	}

	request := httptest.NewRequest(http.MethodGet, "/staff/session", nil)
	request.SetBasicAuth(cfg.STAFF_USERNAME, "incorrect")
	bad := httptest.NewRecorder()
	router.ServeHTTP(bad, request)
	if bad.Code != http.StatusUnauthorized {
		t.Fatalf("wrong password got %d, want 401", bad.Code)
	}
	request.SetBasicAuth(cfg.STAFF_USERNAME, cfg.STAFF_PASSWORD)
	ok := httptest.NewRecorder()
	router.ServeHTTP(ok, request)
	if ok.Code != http.StatusNoContent || ok.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("sign-in returned %d, headers %v", ok.Code, ok.Header())
	}

	preflight := httptest.NewRequest(http.MethodOptions, "/staff/session", nil)
	preflight.Header.Set("Origin", "http://localhost:5174")
	preflight.Header.Set("Access-Control-Request-Headers", "Authorization")
	pre := httptest.NewRecorder()
	router.ServeHTTP(pre, preflight)
	if pre.Code != http.StatusNoContent || pre.Header().Get("Access-Control-Allow-Origin") != "http://localhost:5174" {
		t.Fatalf("preflight returned %d, headers %v", pre.Code, pre.Header())
	}
}

func TestUnconfiguredStaffRoutesAreDisabled(t *testing.T) {
	router := NewRouter(&handlers.HTTPHandler{}, nil, &config.Config{})
	result := httptest.NewRecorder()
	router.ServeHTTP(result, httptest.NewRequest(http.MethodGet, "/staff/session", nil))
	if result.Code != http.StatusServiceUnavailable {
		t.Fatalf("unconfigured sign-in got %d, want 503", result.Code)
	}
}
