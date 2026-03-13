import ChatPanel from "@/components/ChatPanel";
import OceanMap from "@/components/OceanMap";
import { OceanGlobe } from "@/components/Globe/OceanGlobe";
import { Activity, Settings, Database, Waves } from "lucide-react";

export default function DashboardLayout() {
  return (
    <main className="flex h-screen w-full p-4 gap-4 box-border">
      
      {/* Sidebar Navigation (Slim, Icon-based) */}
      <nav className="w-16 h-full glass-card rounded-2xl flex flex-col items-center py-6 justify-between border-white/5">
        <div className="flex flex-col items-center gap-8">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-argo-blue to-argo-cyan flex items-center justify-center shadow-[0_0_20px_rgba(0,240,255,0.4)]">
            <Waves className="text-white" size={20} />
          </div>
          
          <div className="flex flex-col gap-6 mt-4">
            <NavItem icon={<Activity size={20} />} active tooltip="Fleet Overview" />
            <NavItem icon={<Database size={20} />} tooltip="Data Explorer" />
            <NavItem icon={<Settings size={20} />} tooltip="Settings" />
          </div>
        </div>
        
        <div className="w-8 h-8 rounded-full border-2 border-white/20 overflow-hidden bg-surface/50">
           {/* Placeholder Avatar */}
           <img src="https://api.dicebear.com/8.x/bottts/svg?seed=argo" alt="User" />
        </div>
      </nav>

      {/* Main Map Content - Takes up flex-grow */}
      <section className="flex-1 h-full relative flex flex-col gap-4">
         <div className="flex-1 relative">
            <OceanMap />
         </div>
         <div className="h-1/3 min-h-[300px] relative overflow-hidden glass-card rounded-2xl">
            <OceanGlobe />
         </div>
      </section>

      {/* Side Chat Panel - Takes up 450px width fixed */}
      <aside className="w-[450px] h-full shrink-0">
         <ChatPanel />
      </aside>

    </main>
  );
}

function NavItem({ icon, active, tooltip }: { icon: React.ReactNode, active?: boolean, tooltip: string }) {
  return (
    <div className="relative group cursor-pointer">
      <div className={`p-3 rounded-xl transition-all ${
        active 
          ? 'bg-argo-cyan/10 text-argo-cyan shadow-[inset_0_0_10px_rgba(0,240,255,0.2)] border border-argo-cyan/20' 
          : 'text-text-muted hover:text-white hover:bg-white/5'
      }`}>
        {icon}
      </div>
      {/* Tooltip */}
      <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 px-2 py-1 bg-black text-xs rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
        {tooltip}
      </div>
    </div>
  );
}
