package validation

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
)

var (
	// Email regex pattern
	emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)

	// Phone regex pattern (flexible, allows various formats)
	phoneRegex = regexp.MustCompile(`^[\d\s\-\+\(\)]+$`)

	// ISBN regex patterns
	isbn10Regex = regexp.MustCompile(`^\d{9}[\dX]$`)
	isbn13Regex = regexp.MustCompile(`^\d{13}$`)

	// UUID regex pattern
	uuidRegex = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

	// OrderBy field whitelist for common sortable fields
	allowedOrderByFields = map[string]bool{
		"created_at":     true,
		"updated_at":     true,
		"name":           true,
		"title":          true,
		"published_date": true,
		"from_date":      true,
		"due_date":       true,
		"full_name":      true,
	}
)

// ValidateEmail validates email format
func ValidateEmail(email string) error {
	if email == "" {
		return errors.New("email is required")
	}
	if !emailRegex.MatchString(email) {
		return errors.New("invalid email format")
	}
	return nil
}

// ValidatePhone validates phone number format
func ValidatePhone(phone string) error {
	if phone == "" {
		return nil // Phone is optional in most cases
	}
	phone = strings.ReplaceAll(phone, " ", "")
	if len(phone) < 10 || len(phone) > 15 {
		return errors.New("phone number must be between 10 and 15 digits")
	}
	if !phoneRegex.MatchString(phone) {
		return errors.New("invalid phone number format")
	}
	return nil
}

// ValidateStringNotEmpty validates that a string is not empty
func ValidateStringNotEmpty(value, fieldName string) error {
	value = strings.TrimSpace(value)
	if value == "" {
		return errors.New(fieldName + " is required")
	}
	return nil
}

// ValidateStringLength validates string length
func ValidateStringLength(value, fieldName string, min, max int) error {
	length := len(strings.TrimSpace(value))
	if length < min {
		return errors.New(fieldName + " must be at least " + string(rune(min)) + " characters")
	}
	if max > 0 && length > max {
		return errors.New(fieldName + " must not exceed " + string(rune(max)) + " characters")
	}
	return nil
}

// ValidatePositiveInt validates that an integer is positive
func ValidatePositiveInt(value int, fieldName string) error {
	if value <= 0 {
		return errors.New(fieldName + " must be a positive number")
	}
	return nil
}

// ValidateISBN validates ISBN-10 or ISBN-13 format
func ValidateISBN(isbn string) error {
	if isbn == "" {
		return nil // ISBN is optional
	}

	// Remove hyphens and spaces
	isbn = strings.ReplaceAll(isbn, "-", "")
	isbn = strings.ReplaceAll(isbn, " ", "")

	if !isbn10Regex.MatchString(isbn) && !isbn13Regex.MatchString(isbn) {
		return errors.New("invalid ISBN format (must be ISBN-10 or ISBN-13)")
	}
	return nil
}

// ValidateRole validates user role
func ValidateRole(role string) error {
	validRoles := map[string]bool{
		"student": true,
		"teacher": true,
		"admin":   true,
		"librarian": true,
	}

	if role == "" {
		return errors.New("role is required")
	}

	if !validRoles[strings.ToLower(role)] {
		return errors.New("invalid role (must be: student, teacher, admin, or librarian)")
	}
	return nil
}

// ValidatePagination validates pagination parameters
func ValidatePagination(limit, offset int32) error {
	if limit <= 0 {
		return errors.New("limit must be greater than 0")
	}
	if limit > 100 {
		return errors.New("limit must not exceed 100")
	}
	if offset < 0 {
		return errors.New("offset must be non-negative")
	}
	return nil
}

// ValidateUUID validates UUID format
func ValidateUUID(id, fieldName string) error {
	if id == "" {
		return fmt.Errorf("%s is required", fieldName)
	}
	id = strings.ToLower(strings.TrimSpace(id))
	if !uuidRegex.MatchString(id) {
		return fmt.Errorf("invalid %s format (must be valid UUID)", fieldName)
	}
	return nil
}

// ValidateUUIDArray validates an array of UUIDs (for preventing SQL injection)
func ValidateUUIDArray(ids []string, fieldName string) error {
	if len(ids) == 0 {
		return nil // Empty array is allowed
	}
	if len(ids) > 100 {
		return fmt.Errorf("%s array must not exceed 100 items", fieldName)
	}
	for i, id := range ids {
		if err := ValidateUUID(id, fmt.Sprintf("%s[%d]", fieldName, i)); err != nil {
			return err
		}
	}
	return nil
}

// ValidateOrderBy validates orderBy parameter against whitelist
func ValidateOrderBy(orderBy string) error {
	if orderBy == "" {
		return nil // Empty orderBy is allowed (will use default)
	}
	orderBy = strings.ToLower(strings.TrimSpace(orderBy))
	if !allowedOrderByFields[orderBy] {
		return errors.New("invalid orderBy field")
	}
	return nil
}

// ValidateBorrowingStatus validates borrowing status
func ValidateBorrowingStatus(status string) error {
	validStatuses := map[string]bool{
		"borrowed": true,
		"returned": true,
		"lost":     true,
	}
	if status == "" {
		return nil // Status filter is optional
	}
	if !validStatuses[strings.ToLower(status)] {
		return errors.New("invalid status (must be: borrowed, returned, or lost)")
	}
	return nil
}
