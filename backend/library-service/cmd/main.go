package main

import (
	"library/internal/app"
	"library/internal/pkg/config"
)

func main() {
	config := config.Load()

	app.Run(&config)
}
