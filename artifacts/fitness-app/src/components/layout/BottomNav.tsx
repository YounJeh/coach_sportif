import { Link, useLocation } from "wouter";
import { LayoutDashboard, History, Target, TrendingUp, Bot } from "lucide-react";

const tabs = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Home" },
  { path: "/workouts", icon: History, label: "History" },
  { path: "/goals", icon: Target, label: "Goals" },
  { path: "/progress", icon: TrendingUp, label: "Progress" },
  { path: "/ai-coach", icon: Bot, label: "Coach" },
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border max-w-[430px] mx-auto">
      <div className="flex items-center justify-around h-16">
        {tabs.map(({ path, icon: Icon, label }) => {
          const active = location === path || (path === "/workouts" && location.startsWith("/workouts"));
          return (
            <Link key={path} href={path}>
              <button
                className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-150 ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                <span className={`text-[10px] font-medium ${active ? "text-primary" : ""}`}>{label}</span>
                {active && (
                  <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-primary" />
                )}
              </button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
