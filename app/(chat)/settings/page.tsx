'use client';

import { SettingsHeader } from '@/components/settings-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight, Server, Palette, Shield, Bell } from 'lucide-react';
import Link from 'next/link';

const settingsCategories = [
  {
    title: 'MCP Servers',
    description: 'Manage Model Context Protocol servers',
    icon: Server,
    href: '/settings/mcp',
    available: true,
  },
  {
    title: 'Appearance',
    description: 'Customize theme and display preferences',
    icon: Palette,
    href: '/settings/appearance',
    available: false,
  },
  {
    title: 'Privacy & Security',
    description: 'Control data sharing and security settings',
    icon: Shield,
    href: '/settings/privacy',
    available: false,
  },
  {
    title: 'Notifications',
    description: 'Configure alerts and notification preferences',
    icon: Bell,
    href: '/settings/notifications',
    available: false,
  },
];

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-full">
      <SettingsHeader title="Settings" isRoot />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid gap-4 md:grid-cols-2">
            {settingsCategories.map((category) => {
              const Icon = category.icon;
              
              return (
                <Card key={category.title} className={!category.available ? 'opacity-50' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center size-8 rounded-lg bg-muted">
                        <Icon className="size-4" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base">{category.title}</CardTitle>
                        <CardDescription className="text-xs">{category.description}</CardDescription>
                      </div>
                      {category.available && <ChevronRight className="size-4 text-muted-foreground" />}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {category.available ? (
                      <Button asChild variant="outline" size="sm" className="w-full">
                        <Link href={category.href}>
                          Configure
                        </Link>
                      </Button>
                    ) : (
                      <Button disabled variant="outline" size="sm" className="w-full">
                        Coming Soon
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}