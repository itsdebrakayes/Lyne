import { LogOut, Search } from 'lucide-react';
import type { ElementType, FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';

export type DashboardTab = {
  id: string;
  label: string;
  icon: ElementType;
  group?: 'main' | 'utility';
};

type DashboardShellProps = {
  roleLabel: string;
  title: string;
  subtitle: string;
  tabs: DashboardTab[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  tone: 'staff' | 'manager' | 'executive';
  children: ReactNode;
  aside?: ReactNode;
};

export default function DashboardShell({
  roleLabel,
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  tone,
  children,
  aside,
}: DashboardShellProps) {
  const { admin, logout } = useAdminAuth();
  const name = admin?.name || roleLabel;
  const mainTabs = tabs.filter((tab) => tab.group !== 'utility');
  const utilityTabs = tabs.filter((tab) => tab.group === 'utility');
  const [searchTerm, setSearchTerm] = useState('');

  const runPageSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchTerm.trim();
    if (!query) return;
    const pageFind = (window as Window & { find?: (text: string) => boolean }).find;
    pageFind?.(query);
  };

  return (
    <div className={`ops-page ${tone}`}>
      <aside className="ops-sidebar">
        <div className="ops-brand">
          <div>L</div>
          <span>Lyne</span>
        </div>
        <div className="ops-user-card">
          <b>{name}</b>
          <small>{roleLabel}</small>
        </div>
        <nav aria-label={`${roleLabel} dashboard`}>
          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={activeTab === tab.id ? 'active' : ''}
                onClick={() => onTabChange(tab.id)}
                type="button"
              >
                <Icon size={17} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="ops-sidebar-bottom">
          {utilityTabs.length ? (
            <nav className="ops-sidebar-utility" aria-label={`${roleLabel} settings`}>
              {utilityTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  className={activeTab === tab.id ? 'active' : ''}
                  onClick={() => onTabChange(tab.id)}
                  type="button"
                >
                  <Icon size={17} />
                  <span>{tab.label}</span>
                </button>
              );
              })}
            </nav>
          ) : null}
          <button type="button" className="ops-signout-card" onClick={logout}>
            <span>Sign Out</span>
            <small>{admin?.staffRecord.email}</small>
            <i><LogOut size={16} /></i>
          </button>
        </div>
      </aside>
      <main className="ops-main">
        <header className="ops-topbar">
          <form className="ops-search" aria-label="Dashboard search" onSubmit={runPageSearch}>
            <Search size={17} />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search dashboard..."
              aria-label="Search visible dashboard text"
            />
          </form>
          <div className="ops-profile">
            <div>{name[0] || 'L'}</div>
            <span>
              <b>{name}</b>
              <small>{admin?.staffRecord.email}</small>
            </span>
          </div>
        </header>
        <section className="ops-title">
          <div>
            <p>{roleLabel}</p>
            <h1>{title}</h1>
            <span>{subtitle}</span>
          </div>
        </section>
        <div className={aside ? 'ops-content with-aside' : 'ops-content'}>
          <div className="ops-workspace">{children}</div>
          {aside ? <aside className="ops-right-rail">{aside}</aside> : null}
        </div>
      </main>
    </div>
  );
}
