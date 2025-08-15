'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface SettingsHeaderProps {
  title: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  isRoot?: boolean;
}

export function SettingsHeader({ title, breadcrumbs = [], actions, isRoot = false }: SettingsHeaderProps) {
  const allBreadcrumbs = isRoot
    ? [{ label: title }]
    : [{ label: 'Settings', href: '/settings' }, ...breadcrumbs, { label: title }];

  return (
    <div className="flex items-center justify-between p-4 border-b">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        {allBreadcrumbs.map((item, index) => (
          <div key={index} className="flex items-center gap-1">
            {index > 0 && <ChevronRight className="size-3" />}
            {item.href ? (
              <Link 
                href={item.href} 
                className="hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-foreground font-medium">{item.label}</span>
            )}
          </div>
        ))}
      </nav>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}