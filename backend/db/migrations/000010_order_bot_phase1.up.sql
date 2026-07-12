-- Phase 1: VPSTTT order support bot integration.

INSERT INTO permissions (code, module, action, name, description)
VALUES
    ('order.view', 'order', 'view', 'Xem dữ liệu order', 'Tra cứu ví và dịch vụ khách hàng từ hệ thống order VPSTTT'),
    ('order.billing', 'order', 'billing', 'Tạo yêu cầu thanh toán order', 'Tạo QR nạp ví và thao tác thanh toán an toàn')
ON CONFLICT (code) DO UPDATE
SET module = EXCLUDED.module,
    action = EXCLUDED.action,
    name = EXCLUDED.name,
    description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('order.view', 'order.billing')
WHERE r.scope = 'workspace'
  AND r.code IN ('workspace_owner', 'workspace_admin')
ON CONFLICT DO NOTHING;

INSERT INTO bots (workspace_id, slug, name, description, created_by, settings)
SELECT
    w.id,
    definition.slug,
    definition.name,
    definition.description,
    w.owner_id,
    '{"system_default": true, "phase": "order_bot_phase1"}'::jsonb
FROM workspaces w
CROSS JOIN (
    VALUES
        ('cskh-bot', 'CSKH Bot', 'Tra cứu ví, dịch vụ và hỗ trợ khách hàng từ hệ thống order VPSTTT'),
        ('thanh-toan-bot', 'Thanh Toán Bot', 'Tạo QR nạp ví và hỗ trợ kiểm tra thanh toán')
) AS definition(slug, name, description)
WHERE w.deleted_at IS NULL
ON CONFLICT (workspace_id, slug) WHERE deleted_at IS NULL
DO NOTHING;

INSERT INTO bot_installations (bot_id, workspace_id, channel_id, config)
SELECT b.id, b.workspace_id, c.id, '{"system_default": true, "phase": "order_bot_phase1"}'::jsonb
FROM bots b
JOIN (
    VALUES
        ('cskh-bot', 'ticket'),
        ('thanh-toan-bot', 'ke-toan'),
        ('gia-han-bot', 'gia-han')
) AS mapping(bot_slug, channel_slug)
  ON mapping.bot_slug = b.slug::text
JOIN channels c
  ON c.workspace_id = b.workspace_id
 AND c.slug::text = mapping.channel_slug
 AND c.status = 'active'
 AND c.deleted_at IS NULL
WHERE b.status = 'active'
  AND b.deleted_at IS NULL
ON CONFLICT (bot_id, workspace_id, channel_id) WHERE channel_id IS NOT NULL
DO NOTHING;
