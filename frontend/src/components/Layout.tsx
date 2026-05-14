import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ListTodo,
  Store,
  Receipt,
  Truck,
  Calculator,
  Settings as SettingsIcon,
  LogOut,
  Radar,
  BookOpen,
  BarChart3,
  ChevronDown,
  Boxes,
  Crosshair,
  NotebookPen,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { DEMO_MODE } from "@/lib/api";
import { cn } from "@/lib/utils";
import { StatusDot } from "@/components/StatusDot";

type NavLeaf = { to: string; label: string; icon: LucideIcon; end?: boolean };
type NavItem =
  | (NavLeaf & { type: "link" })
  | { type: "group"; label: string; icon: LucideIcon; items: NavLeaf[] };

const ownerNav: NavItem[] = [
  { type: "link", to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  {
    type: "group",
    label: "Stock",
    icon: Boxes,
    items: [
      { to: "/inventory", label: "Inventory", icon: Package },
      { to: "/sales", label: "Sales", icon: Receipt },
      { to: "/expenses", label: "Expenses", icon: Wallet },
      { to: "/operations", label: "Operations", icon: Truck },
      { to: "/calculator", label: "Calculator", icon: Calculator },
    ],
  },
  {
    type: "group",
    label: "Hunt",
    icon: Crosshair,
    items: [
      { to: "/watcher", label: "Watcher", icon: Radar },
      { to: "/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/buylist", label: "Buylist", icon: ListTodo },
      { to: "/retailers", label: "Retailers", icon: Store },
      { to: "/playbook", label: "Playbook", icon: BookOpen },
    ],
  },
  { type: "link", to: "/journal", label: "Journal", icon: NotebookPen },
  { type: "link", to: "/settings", label: "Settings", icon: SettingsIcon },
];

const investorNav: NavItem[] = [
  { type: "link", to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { type: "link", to: "/inventory", label: "Inventory", icon: Package },
  { type: "link", to: "/sales", label: "Sales", icon: Receipt },
];

function Clock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000 * 30);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="tabular text-xs text-muted-foreground">
      {time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
    </span>
  );
}

function TopLink({ item }: { item: NavLeaf }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
          isActive
            ? "bg-white/[0.06] text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03]"
        )
      }
    >
      {({ isActive }) => (
        <>
          <item.icon
            className={cn("h-4 w-4", isActive && "text-[hsl(var(--chip-cyan))]")}
            strokeWidth={2.25}
          />
          <span>{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

function NavGroup({
  label,
  icon: Icon,
  items,
}: {
  label: string;
  icon: LucideIcon;
  items: NavLeaf[];
}) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const closeTimeout = useRef<number | null>(null);

  const isActive = items.some(
    (i) => location.pathname === i.to || location.pathname.startsWith(i.to + "/")
  );

  useEffect(() => {
    return () => {
      if (closeTimeout.current) window.clearTimeout(closeTimeout.current);
    };
  }, []);

  const handleEnter = () => {
    if (closeTimeout.current) {
      window.clearTimeout(closeTimeout.current);
      closeTimeout.current = null;
    }
    setOpen(true);
  };

  const handleLeave = () => {
    closeTimeout.current = window.setTimeout(() => setOpen(false), 150);
  };

  return (
    <div className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
          isActive || open
            ? "bg-white/[0.06] text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03]"
        )}
        aria-expanded={open}
      >
        <Icon
          className={cn("h-4 w-4", isActive && "text-[hsl(var(--chip-cyan))]")}
          strokeWidth={2.25}
        />
        <span>{label}</span>
        <ChevronDown
          className={cn(
            "h-3 w-3 opacity-60 transition-transform",
            open && "rotate-180"
          )}
          strokeWidth={2.5}
        />
      </button>

      {open && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50"
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
        >
          {/* invisible hover bridge so cursor doesn't lose the menu in the gap */}
          <div className="absolute -top-2 left-0 right-0 h-2" />
          <div className="min-w-[200px] rounded-xl border border-white/10 bg-[hsl(228_35%_8%/0.97)] backdrop-blur-xl shadow-2xl chip-shadow py-1.5 animate-fade-in">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2 mx-1 rounded-lg text-sm transition-colors",
                    isActive
                      ? "bg-[hsl(var(--chip-cyan)/0.12)] text-[hsl(var(--chip-cyan))]"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className={cn(
                        "h-4 w-4",
                        isActive && "text-[hsl(var(--chip-cyan))]"
                      )}
                      strokeWidth={2.25}
                    />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = user?.role === "owner" ? ownerNav : investorNav;

  return (
    <div className="h-full p-3 sm:p-5 overflow-hidden">
      <div className="shell h-full rounded-2xl flex flex-col overflow-hidden">
        <header className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-white/5">
          <div className="flex items-center gap-3 shrink-0">
            <img
              src="/logo.png"
              alt="ResellIQ"
              className="h-16 w-auto select-none -my-2"
              draggable={false}
            />
            {DEMO_MODE && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[hsl(var(--chip-orange)/0.18)] text-[hsl(var(--chip-orange))] border border-[hsl(var(--chip-orange)/0.4)]">
                Preview
              </span>
            )}
          </div>

          <nav className="flex items-center gap-1.5">
            {nav.map((item, i) => {
              if (item.type === "link") {
                return <TopLink key={item.to} item={item} />;
              }
              return (
                <NavGroup
                  key={`group-${i}`}
                  label={item.label}
                  icon={item.icon}
                  items={item.items}
                />
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5 shrink-0">
            <div className="hidden md:flex flex-col items-end pr-1 leading-tight">
              <span className="text-xs font-medium">{user?.name}</span>
              <span className="text-[10px] text-muted-foreground capitalize">
                {user?.role}
              </span>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="px-6 py-6 max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </main>

        <footer className="flex items-center justify-between px-5 py-2.5 border-t border-white/5 text-xs text-muted-foreground">
          <span className="tabular">v0.1.0</span>
          <Clock />
          <StatusDot />
        </footer>
      </div>
    </div>
  );
}
