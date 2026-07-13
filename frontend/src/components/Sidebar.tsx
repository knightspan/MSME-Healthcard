import { 
  LayoutDashboard, 
  FileCheck, 
  Database, 
  FileText, 
  Settings, 
  HelpCircle, 
  PlusCircle,
  Network
} from "lucide-react";
import { ViewScreen } from "../types";

interface SidebarProps {
  currentScreen: ViewScreen;
  onScreenChange: (screen: ViewScreen) => void;
  onOpenNewAssessment: () => void;
}

export default function Sidebar({ currentScreen, onScreenChange, onOpenNewAssessment }: SidebarProps) {
  const menuItems = [
    { id: "dashboard" as ViewScreen, label: "Dashboard", icon: LayoutDashboard },
    { id: "assessments" as ViewScreen, label: "Assessments", icon: FileCheck },
    { id: "alt-data" as ViewScreen, label: "Alt-Data", icon: Database },
    { id: "credit-memo" as ViewScreen, label: "Credit Memo", icon: FileText },
  ];

  return (
    <aside className="w-64 border-r border-slate-800 bg-[#0F172A] flex flex-col h-screen fixed left-0 top-0 z-20">
      {/* Brand mark */}
      <div className="px-5 py-5 border-b border-slate-800/60">
        <p className="font-display text-[15px] font-semibold tracking-tight text-white leading-snug">
          IDBI MSME
        </p>
        <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-400/90">
          Bank Lending
        </p>
        <p className="mt-2 text-[10px] font-medium italic text-slate-500 tracking-wide">
          Made by Team Anvay
        </p>
      </div>

      {/* Main Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = currentScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onScreenChange(item.id)}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded transition-all text-left font-sans text-sm font-medium ${
                isActive
                  ? "text-white font-bold border-r-2 border-[#0284C7] bg-slate-800"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
              }`}
            >
              <IconComponent className={`w-[18px] h-[18px] ${isActive ? "text-[#0284C7]" : "text-slate-400"}`} />
              <span>{item.label}</span>
            </button>
          );
        })}

        {/* OCEN Network (Display Link) */}
        <div className="pt-2">
          <button
            onClick={() => onScreenChange("alt-data")}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded transition-all text-left font-sans text-sm font-medium ${
              currentScreen === "alt-data"
                ? "text-white font-bold border-r-2 border-[#0284C7] bg-slate-800"
                : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
            }`}
          >
            <Network className={`w-[18px] h-[18px] ${currentScreen === "alt-data" ? "text-[#0284C7]" : "text-slate-400"}`} />
            <span>OCEN Network</span>
          </button>
        </div>
      </nav>

      {/* Primary Action Trigger */}
      <div className="px-4 py-2">
        <button
          onClick={onOpenNewAssessment}
          className="w-full bg-[#0284C7] text-white hover:bg-[#0284C7]/90 transition-colors py-2.5 px-4 rounded font-sans text-xs font-semibold uppercase tracking-wider flex items-center justify-center space-x-2 shadow-sm"
        >
          <PlusCircle className="w-4 h-4 text-white" />
          <span>New Assessment</span>
        </button>
      </div>

      {/* Footer Settings & Support */}
      <div className="p-4 border-t border-slate-800 space-y-1 bg-slate-900/60">
        <button
          onClick={() => onScreenChange("new-assessment")} // Settings can just open inputs as well
          className="w-full flex items-center space-x-3 px-3 py-2 rounded text-left text-xs font-medium text-slate-400 hover:bg-slate-800/50 hover:text-white"
        >
          <Settings className="w-[16px] h-[16px] text-slate-400" />
          <span>Configure API Settings</span>
        </button>
        <div className="flex items-center space-x-3 px-3 py-2 rounded text-left text-xs font-medium text-slate-400">
          <HelpCircle className="w-[16px] h-[16px] text-slate-400" />
          <span>Support: Online</span>
        </div>
      </div>
    </aside>
  );
}
