import { Settings, Cpu, Zap, type LucideIcon } from 'lucide-react';
import type { OptionPage } from '../options-navigator';
import { GeneralSettings } from './general-settings';
import { ModelSettings } from './model-settings';
import { AdvancedOptions } from './advanced-options';

export interface OptionPageConfig {
  id: string;
  title: string;
  icon: LucideIcon;
  component: React.ComponentType<any>;
  category?: string;
  order?: number;
  enabled?: boolean | ((context: any) => boolean);
}

const defaultOptionPages: OptionPageConfig[] = [
  {
    id: 'general',
    title: 'General Settings',
    icon: Settings,
    component: GeneralSettings,
    category: 'settings',
    order: 1,
    enabled: true,
  },
  {
    id: 'model',
    title: 'Model Settings',
    icon: Cpu,
    component: ModelSettings,
    category: 'ai',
    order: 2,
    enabled: true,
  },
  {
    id: 'advanced',
    title: 'Advanced Options',
    icon: Zap,
    component: AdvancedOptions,
    category: 'developer',
    order: 3,
    enabled: true,
  },
];

class OptionPageRegistry {
  private pages = new Map<string, OptionPageConfig>();

  constructor() {
    defaultOptionPages.forEach((page) => this.register(page));
  }

  register(page: OptionPageConfig): void {
    this.pages.set(page.id, page);
  }

  unregister(id: string): void {
    this.pages.delete(id);
  }

  getPage(id: string): OptionPageConfig | undefined {
    return this.pages.get(id);
  }

  getAllPages(context?: any): OptionPage[] {
    return Array.from(this.pages.values())
      .filter((page) => {
        if (typeof page.enabled === 'function') {
          return page.enabled(context);
        }
        return page.enabled !== false;
      })
      .sort((a, b) => (a.order || 999) - (b.order || 999))
      .map((config) => ({
        id: config.id,
        title: config.title,
        icon: config.icon,
        component: config.component,
      }));
  }

  getPagesByCategory(category: string, context?: any): OptionPage[] {
    return this.getAllPages(context).filter(
      (page) => this.pages.get(page.id)?.category === category,
    );
  }
}

export const optionPageRegistry = new OptionPageRegistry();

export function getOptionPages(context?: any): OptionPage[] {
  return optionPageRegistry.getAllPages(context);
}

export function registerOptionPage(page: OptionPageConfig): void {
  optionPageRegistry.register(page);
}

export function unregisterOptionPage(id: string): void {
  optionPageRegistry.unregister(id);
}