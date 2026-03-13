import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FileText, FilePlus, FileCheck, Settings,
  LogOut, ChevronLeft, ChevronRight, Menu, X, Zap, Users
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={18} /> },
  { label: 'Templates', path: '/templates', icon: <FileText size={18} /> },
  { label: 'Contracts', path: '/contracts', icon: <FileCheck size={18} /> },
];

const adminItems: NavItem[] = [
  { label: 'Settings', path: '/settings', icon: <Settings size={18} />, adminOnly: true },
];

export default function AppLayout() {
  const { user, isAdmin, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo / Branding */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="w-8 h-8 bg-gold-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <Zap size={16} className="text-navy-900" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="text-white font-bold text-base leading-tight truncate">ContractFlow</div>
            <div className="text-gray-400 text-xs truncate">Smart Contracts</div>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className={`text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2 px-1 ${collapsed ? 'hidden' : ''}`}>
          Navigation
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`
            }
            title={collapsed ? item.label : ''}
          >
            <span className="flex-shrink-0">{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}

        {/* Quick action */}
        <NavLink
          to="/contracts/new"
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            `sidebar-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`
          }
          title={collapsed ? 'New Contract' : ''}
        >
          <span className="flex-shrink-0"><FilePlus size={18} /></span>
          {!collapsed && <span>New Contract</span>}
        </NavLink>

        {isAdmin && (
          <>
            <div className={`text-gray-500 text-xs font-semibold uppercase tracking-wider mt-4 mb-2 px-1 ${collapsed ? 'hidden' : ''}`}>
              Admin
            </div>
            {adminItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`
                }
                title={collapsed ? item.label : ''}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User info */}
      <div className="border-t border-white/10 p-3">
        <div className={`flex items-center gap-3 px-2 py-2 rounded-lg ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 bg-gold-500/20 rounded-full flex items-center justify-center flex-shrink-0 text-gold-400 font-bold text-sm">
            {user?.name.charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <div className="text-white text-sm font-medium truncate">{user?.name}</div>
              <div className="text-gray-400 text-xs truncate">{user?.role === 'admin' ? 'Administrator' : 'User'}</div>
            </div>
          )}
          <button
            onClick={logout}
            className="text-gray-400 hover:text-red-400 transition-colors p-1 rounded"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex w-full items-center justify-center mt-2 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        className={`sidebar hidden lg:flex flex-col transition-all duration-300 flex-shrink-0 ${collapsed ? 'w-16' : 'w-64'}`}
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="sidebar fixed left-0 top-0 bottom-0 w-64 z-50 flex flex-col">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
          <button onClick={() => setMobileOpen(true)} className="text-gray-500 hover:text-gray-700">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gold-500 rounded-lg flex items-center justify-center">
              <Zap size={13} className="text-navy-900" />
            </div>
            <span className="font-bold text-navy-900">ContractFlow</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
