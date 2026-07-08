package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/duclamdev/application-chat/backend/internal/config"
	"github.com/duclamdev/application-chat/backend/internal/platform/database"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if len(os.Args) < 2 || os.Args[1] != "up" {
		slog.Error("Lệnh migrate chỉ hỗ trợ: go run ./cmd/migrate up")
		os.Exit(1)
	}

	cfg, err := config.Load()
	if err != nil {
		slog.Error("Không đọc được cấu hình", "error", err)
		os.Exit(1)
	}

	db, err := database.NewPostgres(ctx, cfg.Database)
	if err != nil {
		slog.Error("Không kết nối được cơ sở dữ liệu", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	runner := database.NewMigrationRunner(db, cfg.Database.MigrationsPath)
	if err := runner.Up(ctx); err != nil {
		slog.Error("Chạy migration thất bại", "error", err)
		os.Exit(1)
	}

	slog.Info("Chạy migration thành công")
}
