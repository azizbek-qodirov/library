package main

import (
	"library-gateway/internal/app"
	"library-gateway/internal/pkg/config"
)

func main() {
	cf := config.Load()
	app.Run(cf)
}
