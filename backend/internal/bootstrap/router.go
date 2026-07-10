package bootstrap

import (
	"context"
	nethttp "net/http"
	"time"

	adminapp "github.com/duclamdev/application-chat/backend/internal/modules/admin/application"
	adminhttp "github.com/duclamdev/application-chat/backend/internal/modules/admin/delivery/http"
	adminpostgres "github.com/duclamdev/application-chat/backend/internal/modules/admin/infrastructure/postgres"
	aptokensapp "github.com/duclamdev/application-chat/backend/internal/modules/api_tokens/application"
	aptokenshttp "github.com/duclamdev/application-chat/backend/internal/modules/api_tokens/delivery/http"
	aptokenspostgres "github.com/duclamdev/application-chat/backend/internal/modules/api_tokens/infrastructure/postgres"
	auditapp "github.com/duclamdev/application-chat/backend/internal/modules/audit/application"
	audithttp "github.com/duclamdev/application-chat/backend/internal/modules/audit/delivery/http"
	auditpostgres "github.com/duclamdev/application-chat/backend/internal/modules/audit/infrastructure/postgres"
	authapp "github.com/duclamdev/application-chat/backend/internal/modules/auth/application"
	authhttp "github.com/duclamdev/application-chat/backend/internal/modules/auth/delivery/http"
	authpostgres "github.com/duclamdev/application-chat/backend/internal/modules/auth/infrastructure/postgres"
	backupsapp "github.com/duclamdev/application-chat/backend/internal/modules/backups/application"
	backupshttp "github.com/duclamdev/application-chat/backend/internal/modules/backups/delivery/http"
	backupspostgres "github.com/duclamdev/application-chat/backend/internal/modules/backups/infrastructure/postgres"
	botsapp "github.com/duclamdev/application-chat/backend/internal/modules/bots/application"
	botshttp "github.com/duclamdev/application-chat/backend/internal/modules/bots/delivery/http"
	botspostgres "github.com/duclamdev/application-chat/backend/internal/modules/bots/infrastructure/postgres"
	channelsapp "github.com/duclamdev/application-chat/backend/internal/modules/channels/application"
	channelshttp "github.com/duclamdev/application-chat/backend/internal/modules/channels/delivery/http"
	channelspostgres "github.com/duclamdev/application-chat/backend/internal/modules/channels/infrastructure/postgres"
	contactsapp "github.com/duclamdev/application-chat/backend/internal/modules/contacts/application"
	contactshttp "github.com/duclamdev/application-chat/backend/internal/modules/contacts/delivery/http"
	contactspostgres "github.com/duclamdev/application-chat/backend/internal/modules/contacts/infrastructure/postgres"
	contactsws "github.com/duclamdev/application-chat/backend/internal/modules/contacts/infrastructure/websocket"
	cronjobsapp "github.com/duclamdev/application-chat/backend/internal/modules/cronjobs/application"
	cronjobshttp "github.com/duclamdev/application-chat/backend/internal/modules/cronjobs/delivery/http"
	cronjobspostgres "github.com/duclamdev/application-chat/backend/internal/modules/cronjobs/infrastructure/postgres"
	departmentsapp "github.com/duclamdev/application-chat/backend/internal/modules/departments/application"
	departmentshttp "github.com/duclamdev/application-chat/backend/internal/modules/departments/delivery/http"
	departmentspostgres "github.com/duclamdev/application-chat/backend/internal/modules/departments/infrastructure/postgres"
	filesapp "github.com/duclamdev/application-chat/backend/internal/modules/files/application"
	fileshttp "github.com/duclamdev/application-chat/backend/internal/modules/files/delivery/http"
	filespostgres "github.com/duclamdev/application-chat/backend/internal/modules/files/infrastructure/postgres"
	filesstorage "github.com/duclamdev/application-chat/backend/internal/modules/files/infrastructure/storage"
	healthhttp "github.com/duclamdev/application-chat/backend/internal/modules/health/delivery/http"
	messagesapp "github.com/duclamdev/application-chat/backend/internal/modules/messages/application"
	messageshttp "github.com/duclamdev/application-chat/backend/internal/modules/messages/delivery/http"
	messagespostgres "github.com/duclamdev/application-chat/backend/internal/modules/messages/infrastructure/postgres"
	messagesws "github.com/duclamdev/application-chat/backend/internal/modules/messages/infrastructure/websocket"
	notificationsapp "github.com/duclamdev/application-chat/backend/internal/modules/notifications/application"
	notificationshttp "github.com/duclamdev/application-chat/backend/internal/modules/notifications/delivery/http"
	notificationspostgres "github.com/duclamdev/application-chat/backend/internal/modules/notifications/infrastructure/postgres"
	presenceapp "github.com/duclamdev/application-chat/backend/internal/modules/presence/application"
	presencehttp "github.com/duclamdev/application-chat/backend/internal/modules/presence/delivery/http"
	presencepostgres "github.com/duclamdev/application-chat/backend/internal/modules/presence/infrastructure/postgres"
	rbacapp "github.com/duclamdev/application-chat/backend/internal/modules/rbac/application"
	rbachttp "github.com/duclamdev/application-chat/backend/internal/modules/rbac/delivery/http"
	rbacpostgres "github.com/duclamdev/application-chat/backend/internal/modules/rbac/infrastructure/postgres"
	usersapp "github.com/duclamdev/application-chat/backend/internal/modules/users/application"
	usershttp "github.com/duclamdev/application-chat/backend/internal/modules/users/delivery/http"
	userspostgres "github.com/duclamdev/application-chat/backend/internal/modules/users/infrastructure/postgres"
	webhooksapp "github.com/duclamdev/application-chat/backend/internal/modules/webhooks/application"
	webhookshttp "github.com/duclamdev/application-chat/backend/internal/modules/webhooks/delivery/http"
	webhooksender "github.com/duclamdev/application-chat/backend/internal/modules/webhooks/infrastructure/httpclient"
	webhookspostgres "github.com/duclamdev/application-chat/backend/internal/modules/webhooks/infrastructure/postgres"
	workspacesapp "github.com/duclamdev/application-chat/backend/internal/modules/workspaces/application"
	workspaceshttp "github.com/duclamdev/application-chat/backend/internal/modules/workspaces/delivery/http"
	workspacespostgres "github.com/duclamdev/application-chat/backend/internal/modules/workspaces/infrastructure/postgres"
	wshttp "github.com/duclamdev/application-chat/backend/internal/platform/websocket/delivery/http"
	sharedauth "github.com/duclamdev/application-chat/backend/internal/shared/auth"
	"github.com/duclamdev/application-chat/backend/internal/shared/middleware"
	"github.com/duclamdev/application-chat/backend/internal/shared/response"
	"github.com/gin-gonic/gin"
)

func (a *API) registerRoutes() {
	healthHandler := healthhttp.NewHandler(healthhttp.BuildInfo{
		Name:      a.cfg.App.Name,
		Env:       a.cfg.App.Env,
		Version:   a.cfg.App.Version,
		StartedAt: a.cfg.App.StartedAt,
		Now:       time.Now,
		Checks:    a.healthChecks(),
	})

	healthHandler.Register(a.engine)

	a.registerAPIV1()
}

func (a *API) registerAPIV1() {
	v1 := a.engine.Group("/api/v1")
	v1.GET("", func(c *gin.Context) {
		response.OK(c, nethttp.StatusOK, gin.H{
			"name":    a.cfg.App.Name,
			"version": a.cfg.App.Version,
			"status":  "ok",
		})
	})

	if a.resources.Database == nil {
		v1.Any("/*path", func(c *gin.Context) {
			response.Fail(c, nethttp.StatusServiceUnavailable, "DATABASE_DISABLED", "Database đang tắt nên API nghiệp vụ chưa sẵn sàng.", nil)
		})
		return
	}

	tokenManager := sharedauth.NewManager(
		a.cfg.Security.JWTAccessSecret,
		a.cfg.Security.JWTRefreshSecret,
		15*time.Minute,
		30*24*time.Hour,
	)
	authMiddleware := middleware.Auth(tokenManager)
	pool := a.resources.Database.Pool()

	authRepo := authpostgres.NewRepository(pool)
	authService := authapp.NewService(authRepo, tokenManager)
	authHandler := authhttp.NewHandler(authService)
	authHandler.RegisterRoutes(v1.Group("/auth"), authMiddleware)

	rbacRepo := rbacpostgres.NewRepository(pool)
	rbacService := rbacapp.NewService(rbacRepo)
	rbacHandler := rbachttp.NewHandler(rbacService)
	rbacHandler.RegisterRoutes(v1.Group("/rbac"), authMiddleware)

	usersRepo := userspostgres.NewRepository(pool)
	usersService := usersapp.NewService(usersRepo, rbacService)
	usersHandler := usershttp.NewHandler(usersService)
	usersHandler.RegisterRoutes(v1.Group("/users"), authMiddleware)

	contactsRepo := contactspostgres.NewRepository(pool)
	var contactsRealtime contactsapp.RealtimePublisher
	if a.resources.WebSocket != nil {
		contactsRealtime = contactsws.NewPublisher(a.resources.WebSocket)
	}
	contactsService := contactsapp.NewService(contactsRepo, contactsRealtime)
	contactsHandler := contactshttp.NewHandler(contactsService)
	contactsHandler.RegisterRoutes(v1, authMiddleware)

	adminRepo := adminpostgres.NewRepository(pool)
	adminService := adminapp.NewService(adminRepo, rbacService)
	adminHandler := adminhttp.NewHandler(adminService, a.healthChecks())
	adminHandler.RegisterRoutes(v1, authMiddleware)

	auditRepo := auditpostgres.NewRepository(pool)
	auditService := auditapp.NewService(auditRepo, rbacService)
	auditHandler := audithttp.NewHandler(auditService)
	auditHandler.RegisterRoutes(v1, authMiddleware)

	cronjobsRepo := cronjobspostgres.NewRepository(pool)
	cronjobsService := cronjobsapp.NewService(cronjobsRepo, rbacService, cronjobsapp.WithScriptAllowlist(a.cfg.ModuleRunner.ScriptAllowlist))
	cronjobsHandler := cronjobshttp.NewHandler(cronjobsService, a.cfg.App.ServiceName)
	cronjobsHandler.RegisterRoutes(v1, authMiddleware)

	backupsRepo := backupspostgres.NewRepository(pool)
	backupsService := backupsapp.NewService(backupsRepo, a.resources.Storage, rbacService, backupsapp.Options{
		DatabaseURL:     a.cfg.Database.URL,
		PGDumpPath:      a.cfg.Backup.PGDumpPath,
		Timeout:         a.cfg.Backup.Timeout,
		StorageProvider: a.cfg.Storage.Provider,
	})
	backupsHandler := backupshttp.NewHandler(backupsService)
	backupsHandler.RegisterRoutes(v1, authMiddleware)

	apiTokensRepo := aptokenspostgres.NewRepository(pool)
	apiTokensService := aptokensapp.NewService(apiTokensRepo, rbacService)
	apiTokensHandler := aptokenshttp.NewHandler(apiTokensService)
	apiTokensHandler.RegisterRoutes(v1, authMiddleware)

	if a.resources.WebSocket != nil {
		wsHandler := wshttp.NewHandler(a.resources.WebSocket, tokenManager)
		wsHandler.RegisterRoutes(v1)
	}

	workspacesRepo := workspacespostgres.NewRepository(pool)
	workspacesService := workspacesapp.NewService(workspacesRepo, rbacService)
	workspacesHandler := workspaceshttp.NewHandler(workspacesService)
	workspacesHandler.RegisterRoutes(v1.Group("/workspaces"), authMiddleware)

	departmentsRepo := departmentspostgres.NewRepository(pool)
	departmentsService := departmentsapp.NewService(departmentsRepo, rbacService)
	departmentsHandler := departmentshttp.NewHandler(departmentsService)
	departmentsHandler.RegisterRoutes(v1, authMiddleware)

	channelsRepo := channelspostgres.NewRepository(pool)
	channelsService := channelsapp.NewService(channelsRepo, rbacService)
	channelsHandler := channelshttp.NewHandler(channelsService)
	channelsHandler.RegisterRoutes(v1, authMiddleware)

	notificationsRepo := notificationspostgres.NewRepository(pool)
	notificationsService := notificationsapp.NewService(notificationsRepo)
	notificationsHandler := notificationshttp.NewHandler(notificationsService)
	notificationsHandler.RegisterRoutes(v1, authMiddleware)

	presenceRepo := presencepostgres.NewRepository(pool)
	presenceService := presenceapp.NewService(presenceRepo, rbacService)
	presenceHandler := presencehttp.NewHandler(presenceService)
	presenceHandler.RegisterRoutes(v1, authMiddleware)

	botsRepo := botspostgres.NewRepository(pool)
	botsService := botsapp.NewService(botsRepo, rbacService)
	botsHandler := botshttp.NewHandler(botsService)
	botsHandler.RegisterRoutes(v1, authMiddleware)

	webhooksRepo := webhookspostgres.NewRepository(pool)
	webhooksService := webhooksapp.NewService(webhooksRepo, rbacService, apiTokensService, webhooksender.NewSender())
	webhooksHandler := webhookshttp.NewHandler(webhooksService, a.cfg.App.URL)
	webhooksHandler.RegisterRoutes(v1, authMiddleware)

	if a.resources.Storage != nil {
		filesRepo := filespostgres.NewRepository(pool)
		filesStore := filesstorage.NewStore(a.resources.Storage)
		filesService := filesapp.NewService(filesRepo, filesStore, rbacService, a.cfg.Storage.Provider, a.cfg.Storage.Bucket)
		filesHandler := fileshttp.NewHandler(filesService)
		filesHandler.RegisterRoutes(v1, authMiddleware)
	}

	messagesRepo := messagespostgres.NewRepository(pool)
	var realtimePublisher messagesapp.RealtimePublisher
	if a.resources.WebSocket != nil {
		realtimePublisher = messagesws.NewPublisher(a.resources.WebSocket)
	}
	messagesService := messagesapp.NewService(messagesRepo, rbacService, realtimePublisher)
	messagesHandler := messageshttp.NewHandler(messagesService)
	messagesHandler.RegisterRoutes(v1, authMiddleware)
}

func (a *API) healthChecks() map[string]healthhttp.CheckFunc {
	checks := map[string]healthhttp.CheckFunc{}

	if a.resources.Database != nil {
		checks["database"] = func(ctx context.Context) error {
			return a.resources.Database.Ping(ctx)
		}
	}
	if a.resources.Redis != nil {
		checks["redis"] = func(ctx context.Context) error {
			return a.resources.Redis.Ping(ctx)
		}
	}
	if a.resources.RabbitMQ != nil {
		checks["rabbitmq"] = func(ctx context.Context) error {
			return a.resources.RabbitMQ.Ping(ctx)
		}
	}
	if a.resources.Storage != nil {
		checks["storage"] = func(ctx context.Context) error {
			return a.resources.Storage.Health(ctx)
		}
	}
	if a.resources.WebSocket != nil {
		checks["websocket"] = func(ctx context.Context) error {
			return a.resources.WebSocket.Health(ctx)
		}
	}

	return checks
}
