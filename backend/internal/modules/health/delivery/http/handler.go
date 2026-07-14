package http

import (
	"context"
	"encoding/json"
	nethttp "net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/duclamdev/application-chat/backend/internal/shared/response"
	"github.com/gin-gonic/gin"
)

type BuildInfo struct {
	Name                      string
	Env                       string
	Version                   string
	DesktopMinimumVersion     string
	DesktopRecommendedVersion string
	DesktopReleaseManifestDir string
	DesktopUpdateURL          string
	StartedAt                 time.Time
	Now                       func() time.Time
	Checks                    map[string]CheckFunc
}

type CheckFunc func(context.Context) error

var desktopReleasePathPartPattern = regexp.MustCompile(`^[A-Za-z0-9._+-]+$`)

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
	router.GET("/desktop/releases/:channel/:target/:arch/:current_version", h.DesktopRelease)
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
		"app": h.build.Name,
		"clients": gin.H{
			"desktop": gin.H{
				"minimum_version":     h.build.DesktopMinimumVersion,
				"recommended_version": h.build.DesktopRecommendedVersion,
				"update_url":          h.build.DesktopUpdateURL,
			},
		},
		"env":     h.build.Env,
		"version": h.build.Version,
	})
}

func (h *Handler) DesktopRelease(c *gin.Context) {
	root := strings.TrimSpace(h.build.DesktopReleaseManifestDir)
	if root == "" {
		response.NoContent(c)
		return
	}

	channel := strings.ToLower(strings.TrimSpace(c.Param("channel")))
	target := strings.TrimSpace(c.Param("target"))
	arch := strings.TrimSpace(c.Param("arch"))
	currentVersion := strings.TrimSpace(c.Param("current_version"))
	if channel != "stable" && channel != "beta" {
		response.Fail(c, nethttp.StatusBadRequest, "INVALID_RELEASE_CHANNEL", "Desktop release channel khong hop le.", nil)
		return
	}
	if !safeDesktopReleasePart(target) || !safeDesktopReleasePart(arch) || !safeDesktopReleasePart(currentVersion) {
		response.Fail(c, nethttp.StatusBadRequest, "INVALID_RELEASE_TARGET", "Desktop release target khong hop le.", nil)
		return
	}

	manifestPath, ok := safeManifestPath(root, channel, target, arch)
	if !ok {
		response.Fail(c, nethttp.StatusBadRequest, "INVALID_RELEASE_TARGET", "Desktop release target khong hop le.", nil)
		return
	}
	content, err := os.ReadFile(manifestPath)
	if err != nil {
		if os.IsNotExist(err) {
			response.NoContent(c)
			return
		}
		response.Fail(c, nethttp.StatusInternalServerError, "DESKTOP_RELEASE_UNAVAILABLE", "Khong doc duoc desktop release manifest.", nil)
		return
	}
	if !json.Valid(content) {
		response.Fail(c, nethttp.StatusInternalServerError, "DESKTOP_RELEASE_INVALID", "Desktop release manifest khong phai JSON hop le.", nil)
		return
	}

	c.Data(nethttp.StatusOK, "application/json; charset=utf-8", content)
}

func safeDesktopReleasePart(value string) bool {
	return value != "" &&
		value != "." &&
		value != ".." &&
		!strings.Contains(value, "..") &&
		desktopReleasePathPartPattern.MatchString(value)
}

func safeManifestPath(root string, channel string, target string, arch string) (string, bool) {
	absRoot, err := filepath.Abs(root)
	if err != nil {
		return "", false
	}
	manifestPath := filepath.Join(absRoot, channel, target, arch, "latest.json")
	absManifest, err := filepath.Abs(manifestPath)
	if err != nil {
		return "", false
	}
	rel, err := filepath.Rel(absRoot, absManifest)
	if err != nil || rel == "." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) || rel == ".." {
		return "", false
	}
	return absManifest, true
}
