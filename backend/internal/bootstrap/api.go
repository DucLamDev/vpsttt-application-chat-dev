package bootstrap

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/duclamdev/application-chat/backend/internal/config"
	"github.com/duclamdev/application-chat/backend/internal/shared/middleware"
	"github.com/gin-gonic/gin"
)

type API struct {
	cfg       *config.Config
	resources *Resources
	engine    *gin.Engine
	server    *http.Server
}

func NewAPI(cfg *config.Config) (*API, error) {
	configureLogger(cfg)
	configureGin(cfg)

	resources, err := NewResources(context.Background(), cfg)
	if err != nil {
		return nil, err
	}

	engine := gin.New()
	if err := engine.SetTrustedProxies(cfg.HTTP.TrustedProxies); err != nil {
		return nil, err
	}
	engine.Use(
		middleware.RequestID(),
		middleware.Recovery(),
		middleware.AccessLog(),
	)
	if cfg.HTTP.SecureHeadersEnabled {
		engine.Use(middleware.SecurityHeaders(cfg.App.Env == "production"))
	}
	engine.Use(middleware.CORS(cfg.HTTP.CORSAllowedOrigins))
	if cfg.Metrics.Enabled {
		httpMetrics := middleware.NewHTTPMetrics()
		httpMetrics.RegisterGaugeFunc(func() []middleware.Gauge {
			return resourceGauges(resources)
		})
		engine.Use(httpMetrics.Middleware())
		engine.GET(cfg.Metrics.Path, httpMetrics.Handler())
	}
	if cfg.HTTP.RateLimitEnabled {
		engine.Use(middleware.RateLimit(cfg.HTTP.RateLimitPerMinute, cfg.HTTP.RateLimitBurst))
	}

	api := &API{
		cfg:       cfg,
		resources: resources,
		engine:    engine,
	}
	api.registerRoutes()

	api.server = &http.Server{
		Addr:         cfg.HTTP.Addr(),
		Handler:      engine,
		ReadTimeout:  cfg.HTTP.ReadTimeout,
		WriteTimeout: cfg.HTTP.WriteTimeout,
		IdleTimeout:  cfg.HTTP.IdleTimeout,
	}

	return api, nil
}

func resourceGauges(resources *Resources) []middleware.Gauge {
	gauges := []middleware.Gauge{
		{
			Name:   "webtui_dependency_up",
			Help:   "Trạng thái dependency kỹ thuật của API.",
			Labels: map[string]string{"dependency": "postgres"},
			Value:  boolToGauge(resources != nil && resources.Database != nil),
		},
		{
			Name:   "webtui_dependency_up",
			Help:   "Trạng thái dependency kỹ thuật của API.",
			Labels: map[string]string{"dependency": "redis"},
			Value:  boolToGauge(resources != nil && resources.Redis != nil),
		},
		{
			Name:   "webtui_dependency_up",
			Help:   "Trạng thái dependency kỹ thuật của API.",
			Labels: map[string]string{"dependency": "rabbitmq"},
			Value:  boolToGauge(resources != nil && resources.RabbitMQ != nil),
		},
	}

	if resources != nil && resources.WebSocket != nil {
		stats := resources.WebSocket.Stats()
		gauges = append(gauges,
			middleware.Gauge{
				Name:  "webtui_websocket_clients",
				Help:  "Số client WebSocket đang kết nối trên node hiện tại.",
				Value: float64(stats["clients"]),
			},
			middleware.Gauge{
				Name:  "webtui_websocket_rooms",
				Help:  "Số room WebSocket đang có thành viên trên node hiện tại.",
				Value: float64(stats["rooms"]),
			},
		)
	}

	return gauges
}

func boolToGauge(value bool) float64 {
	if value {
		return 1
	}
	return 0
}

func (a *API) Run(ctx context.Context) error {
	defer a.resources.Close()

	errCh := make(chan error, 1)

	go func() {
		slog.Info("API đang lắng nghe", "addr", a.server.Addr, "env", a.cfg.App.Env)
		errCh <- a.server.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), a.cfg.HTTP.ShutdownTimeout)
		defer cancel()

		slog.Info("API đang tắt")
		return a.server.Shutdown(shutdownCtx)
	case err := <-errCh:
		return err
	}
}

func (a *API) Engine() *gin.Engine {
	return a.engine
}

func configureGin(cfg *config.Config) {
	if cfg.App.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
		return
	}
	gin.SetMode(gin.DebugMode)
}
