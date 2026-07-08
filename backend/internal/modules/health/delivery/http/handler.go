package http

import (
	"context"
	nethttp "net/http"
	"time"

	"github.com/duclamdev/application-chat/backend/internal/shared/response"
	"github.com/gin-gonic/gin"
)

type BuildInfo struct {
	Name      string
	Env       string
	Version   string
	StartedAt time.Time
	Now       func() time.Time
	Checks    map[string]CheckFunc
}

type CheckFunc func(context.Context) error

type Handler struct {
	build BuildInfo
}

func NewHandler(build BuildInfo) *Handler {
	if build.Now == nil {
		build.Now = time.Now
	}
	return &Handler{build: build}
}

func (h *Handler) Register(router gin.IRouter) {
	router.GET("/health", h.Health)
	router.GET("/ready", h.Ready)
	router.GET("/version", h.Version)
}

func (h *Handler) Health(c *gin.Context) {
	response.OK(c, nethttp.StatusOK, gin.H{
		"status": "ok",
		"app":    h.build.Name,
		"env":    h.build.Env,
		"uptime": h.build.Now().UTC().Sub(h.build.StartedAt).String(),
	})
}

func (h *Handler) Ready(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
	defer cancel()

	status := "ready"
	code := nethttp.StatusOK
	checks := gin.H{"api": "ok"}

	for name, check := range h.build.Checks {
		if check == nil {
			continue
		}
		if err := check(ctx); err != nil {
			status = "not_ready"
			code = nethttp.StatusServiceUnavailable
			checks[name] = err.Error()
			continue
		}
		checks[name] = "ok"
	}

	response.OK(c, code, gin.H{
		"status": status,
		"checks": checks,
	})
}

func (h *Handler) Version(c *gin.Context) {
	response.OK(c, nethttp.StatusOK, gin.H{
		"app":     h.build.Name,
		"env":     h.build.Env,
		"version": h.build.Version,
	})
}
