'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Activity, Settings, LogOut } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import clsx from 'clsx';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Tenants', href: '/tenants', icon: Users },
  { name: 'Activity', href: '/activity', icon: Activity },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <div className="w-64 bg-gray-800 text-white flex flex-col">
      <div className="p-6">
        <h1 className="text-2xl font-bold">Winston</h1>
        <p className="text-sm text-gray-400 mt-1">Admin Dashboard</p>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-700 space-y-3">
        {session?.user && (
          <div className="text-sm text-gray-400">
            Signed in as <span className="text-white font-medium">{session.user.name}</span>
          </div>
        )}
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm font-medium">Sign Out</span>
        </button>
        <div className="text-xs text-gray-400">
          Version 0.1.0
        </div>
      </div>
    </div>
  );
}
