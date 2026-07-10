import type { ComponentType } from "react";
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
  brandLabel?: string;
  className?: string;
  items: NavigationRailItem[];
  onSelect?: (id: string) => void;
  profile?: Pick<AvatarProps, "name" | "src" | "status">;
};

export function NavigationRail({
  activeId,
  ariaLabel,
  brandLabel = "W",
  className,
  items,
  onSelect,
  profile
}: NavigationRailProps) {
  return (
    <aside aria-label={ariaLabel} className={cn("ui-navigation-rail", className)}>
      <div className="ui-navigation-rail__brand">{brandLabel}</div>
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
        </div>
      ) : null}
    </aside>
  );
}
