import { useState } from 'react';
import { useTheme } from 'next-themes';
import {
  FlaskConical,
  BookOpen,
  Settings,
  Wand2,
  Moon,
  Sun,
  Menu,
  X,
  ChevronRight,
  ActivitySquare,
  ReplaceAll,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { WorkbenchView } from './WorkbenchView';
import { DictionaryView } from './DictionaryView';
import { RuleBuilderView } from './RuleBuilderView';
import { ExpansionView } from './ExpansionView';
import { SettingsView } from './SettingsView';

export type AppView = 'workbench' | 'dictionary' | 'rules' | 'expansions' | 'settings';

const NAV_ITEMS: Array<{ id: AppView; label: string; icon: React.ElementType; description: string }> = [
  { id: 'workbench',  label: 'Workbench',        icon: FlaskConical, description: 'Live SIG Parser'           },
  { id: 'dictionary', label: 'SIG Dictionary',    icon: BookOpen,     description: 'Code Master Table'          },
  { id: 'rules',      label: 'Rule Builder',      icon: Wand2,        description: 'Custom Transform Rules'     },
  { id: 'expansions', label: 'Phrase Expansions', icon: ReplaceAll,   description: 'Alias & Expansion Mappings' },
  { id: 'settings',   label: 'Settings',          icon: Settings,     description: 'Import & Manage Data'       },
];

export function AppLayout() {
  const [activeView, setActiveView] = useState<AppView>('workbench');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { theme, setTheme } = useTheme();

  const ActiveIcon = NAV_ITEMS.find((n) => n.id === activeView)?.icon ?? FlaskConical;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col flex-shrink-0 transition-all duration-200 ease-in-out border-r border-border overflow-hidden',
          'bg-[hsl(var(--sidebar-bg))]',
          sidebarOpen ? 'w-56' : 'w-14'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-3 py-4 border-b border-white/8 min-h-[57px]">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/90 flex-shrink-0">
            <ActivitySquare className="w-4 h-4 text-white" />
          </div>
          {sidebarOpen && (
            <div className="min-w-0">
              <p className="text-white font-semibold text-[13px] leading-tight truncate">SIG Parser</p>
              <p className="text-[hsl(var(--sidebar-fg))] text-[10px] leading-tight truncate">Normalization Workbench</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 flex flex-col gap-0.5 overflow-y-auto scrollbar-thin">
          {NAV_ITEMS.map(({ id, label, icon: Icon, description }) => (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-2 py-2 w-full text-left transition-colors duration-100 group',
                activeView === id
                  ? 'bg-[hsl(var(--sidebar-active-bg))] text-[hsl(var(--sidebar-active-fg))]'
                  : 'text-[hsl(var(--sidebar-fg))] hover:bg-[hsl(var(--sidebar-hover-bg))] hover:text-white'
              )}
              title={!sidebarOpen ? label : undefined}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              {sidebarOpen && (
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium leading-tight truncate">{label}</p>
                  <p className={cn(
                    'text-[10px] leading-tight truncate',
                    activeView === id ? 'text-white/60' : 'text-[hsl(var(--sidebar-fg))]/70'
                  )}>{description}</p>
                </div>
              )}
              {sidebarOpen && activeView === id && (
                <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
              )}
            </button>
          ))}
        </nav>

        {/* Bottom controls */}
        <div className="border-t border-white/8 px-2 py-3 flex flex-col gap-1">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex items-center gap-2.5 rounded-lg px-2 py-2 w-full text-[hsl(var(--sidebar-fg))] hover:bg-[hsl(var(--sidebar-hover-bg))] hover:text-white transition-colors"
            title={!sidebarOpen ? 'Toggle theme' : undefined}
          >
            {theme === 'dark'
              ? <Sun className="w-[18px] h-[18px] flex-shrink-0" />
              : <Moon className="w-[18px] h-[18px] flex-shrink-0" />}
            {sidebarOpen && <span className="text-[13px]">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex items-center gap-2.5 rounded-lg px-2 py-2 w-full text-[hsl(var(--sidebar-fg))] hover:bg-[hsl(var(--sidebar-hover-bg))] hover:text-white transition-colors"
            title="Toggle sidebar"
          >
            {sidebarOpen ? <X className="w-[18px] h-[18px] flex-shrink-0" /> : <Menu className="w-[18px] h-[18px] flex-shrink-0" />}
            {sidebarOpen && <span className="text-[13px]">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center justify-between px-5 border-b border-border bg-card/80 backdrop-blur-sm min-h-[57px] flex-shrink-0">
          <div className="flex items-center gap-2">
            <ActiveIcon className="w-4 h-4 text-primary" />
            <h1 className="font-semibold text-sm text-foreground">
              {NAV_ITEMS.find((n) => n.id === activeView)?.label}
            </h1>
            <span className="text-muted-foreground text-xs hidden sm:inline">
              — {NAV_ITEMS.find((n) => n.id === activeView)?.description}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border uppercase tracking-wider">
              SIG Parser MVP v1
            </span>
          </div>
        </header>

        {/* View */}
        <main className="flex-1 overflow-auto scrollbar-thin">
          {activeView === 'workbench'  && <WorkbenchView />}
          {activeView === 'dictionary' && <DictionaryView />}
          {activeView === 'rules'      && <RuleBuilderView />}
          {activeView === 'expansions' && <ExpansionView />}
          {activeView === 'settings'   && <SettingsView />}
        </main>
      </div>
    </div>
  );
}
