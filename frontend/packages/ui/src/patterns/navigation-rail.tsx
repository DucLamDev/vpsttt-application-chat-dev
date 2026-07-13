import type { ComponentType, ReactNode } from "react";
import { Avatar, type AvatarProps } from "../components/avatar";
import { Button } from "../components/button";
import { Tooltip } from "../components/tooltip";
import { cn } from "../lib/cn";

export type RailIcon = ComponentType<{
  "aria-hidden"?: true | "true";
  className?: string;
  size?: number;
}>;

export type NavigationRailItem = {
  id: string;
  label: string;
  icon: RailIcon;
  badge?: number;
};

export type NavigationRailProps = {
  activeId: string;
  ariaLabel: string;
  brandLabel?: ReactNode;
  brandLogoAlt?: string;
  brandLogoSrc?: string;
  brandTitle?: string;
  className?: string;
  items: NavigationRailItem[];
  onSelect?: (id: string) => void;
  profile?: Pick<AvatarProps, "name" | "src" | "status"> & {
    description?: string;
    label?: string;
  };
};

export function NavigationRail({
  activeId,
  ariaLabel,
  brandLabel = "W",
  brandLogoAlt = "",
  brandLogoSrc,
  brandTitle,
  className,
  items,
  onSelect,
  profile
}: NavigationRailProps) {
  return (
    <aside aria-label={ariaLabel} className={cn("ui-navigation-rail", className)}>
      <div className="ui-navigation-rail__brand-wrap">
        <div className={cn("ui-navigation-rail__brand", brandLogoSrc && "ui-navigation-rail__brand--image")}>
          {brandLogoSrc ? <img alt={brandLogoAlt} src={brandLogoSrc} /> : brandLabel}
        </div>
        {brandTitle ? <strong>{brandTitle}</strong> : null}
      </div>
      <nav className="ui-navigation-rail__nav">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Tooltip key={item.id} label={item.label}>
              <Button
                aria-label={item.label}
                aria-pressed={activeId === item.id}
                className={cn(
                  "ui-navigation-rail__item",
                  activeId === item.id && "ui-navigation-rail__item--active"
                )}
                onClick={() => onSelect?.(item.id)}
                variant="ghost"
              >
                <Icon aria-hidden="true" size={20} />
                <span>{item.label}</span>
                {item.badge ? <i>{item.badge}</i> : null}
              </Button>
            </Tooltip>
          );
        })}
      </nav>
      {profile ? (
        <div className="ui-navigation-rail__profile">
          <Avatar name={profile.name} src={profile.src} status={profile.status} />
          {profile.label || profile.description ? (
            <span>
              {profile.label ? <strong>{profile.label}</strong> : null}
              {profile.description ? <small>{profile.description}</small> : null}
            </span>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
