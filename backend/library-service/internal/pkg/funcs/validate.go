package funcs

import "regexp"

var emailPattern = regexp.MustCompile(`(?i)^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$`)

func IsValidEmail(email string) bool {
	return emailPattern.MatchString(email)
}

func IsValidRole(role string) bool {
	return role == "student" || role == "teacher"
}
