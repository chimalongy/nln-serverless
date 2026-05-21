'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FileText, Settings, AlertCircle, Menu, X } from 'lucide-react';

const navLinks = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/articles', label: 'Articles', icon: FileText },
    { href: '/errors', label: 'Error Logs', icon: AlertCircle },
    { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
    const [open, setOpen] = useState(false);
    const pathname = usePathname();

    // Close sidebar on route change (mobile)
    useEffect(() => {
        setOpen(false);
    }, [pathname]);

    // Prevent body scroll when mobile menu is open
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    const NavContent = () => (
        <>
            <div className="p-6 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                        NLN Automation
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">Command Center</p>
                </div>
                {/* Close button — mobile only */}
                <button
                    onClick={() => setOpen(false)}
                    className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
                    aria-label="Close menu"
                >
                    <X size={20} />
                </button>
            </div>

            <nav className="flex-1 px-4 space-y-1 mt-2">
                {navLinks.map(({ href, label, icon: Icon }) => {
                    const active = pathname === href;
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors ${active
                                ? 'bg-blue-600/20 text-blue-400 font-medium'
                                : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                                }`}
                        >
                            <Icon size={20} className={active ? 'text-blue-400' : ''} />
                            <span>{label}</span>
                            {active && (
                                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />
                            )}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-slate-700/50">
                <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>System Status</span>
                    <span className="flex items-center text-green-400">
                        <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
                        Online
                    </span>
                </div>
            </div>
        </>
    );

    return (
        <>
            {/* ── Mobile top bar ─────────────────────────────── */}
            <header className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-slate-900/95 backdrop-blur border-b border-slate-700/50">
                <div>
                    <span className="text-base font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                        NLN Automation
                    </span>
                </div>
                <button
                    onClick={() => setOpen(true)}
                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
                    aria-label="Open menu"
                >
                    <Menu size={22} />
                </button>
            </header>

            {/* ── Mobile overlay ──────────────────────────────── */}
            {open && (
                <div
                    className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                    onClick={() => setOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* ── Mobile slide-in drawer ──────────────────────── */}
            <aside
                className={`
          md:hidden fixed top-0 left-0 z-50 h-full w-72 flex flex-col
          bg-slate-900 border-r border-slate-700/50 shadow-2xl
          transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
                aria-label="Mobile navigation"
            >
                <NavContent />
            </aside>

            {/* ── Desktop sidebar ─────────────────────────────── */}
            <aside className="hidden md:flex w-64 flex-shrink-0 glass-panel m-4 flex-col border-r-0">
                <NavContent />
            </aside>
        </>
    );
}
