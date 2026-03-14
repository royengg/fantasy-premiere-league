import { useState } from "react";
import { 
  Home, Users, Settings, Bell, HelpCircle, LogOut, 
  MessageSquare, Calendar, BarChart2, Bookmark,
  X, Search, UserPlus, Mail, Trophy
} from "lucide-react";

interface SidebarProps {
  currentScreen: string;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

interface Friend {
  id: string;
  name: string;
  status: "online" | "offline" | "playing";
  level: number;
}

const mockFriends: Friend[] = [
  { id: "1", name: "Rahul Sharma", status: "online", level: 24 },
  { id: "2", name: "Priya Patel", status: "playing", level: 31 },
  { id: "3", name: "Vikram Singh", status: "offline", level: 18 },
  { id: "4", name: "Ananya Gupta", status: "online", level: 27 },
  { id: "5", name: "Arjun Reddy", status: "offline", level: 22 },
];

export function Sidebar({ currentScreen, onNavigate, onLogout }: SidebarProps) {
  const [showFriends, setShowFriends] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [friendSearch, setFriendSearch] = useState("");
  const [pendingRequests] = useState(2);

  const navItems = [
    { id: "home", icon: Home, label: "Home" },
    { id: "contests", icon: Calendar, label: "Contests" },
    { id: "leagues", icon: Trophy, label: "Leagues" },
    { id: "predictions", icon: BarChart2, label: "Predictions" },
    { id: "locker", icon: Bookmark, label: "Locker" },
  ];

  const bottomItems = [
    { id: "notifications", icon: Bell, label: "Notifications", badge: 3 },
    { id: "friends", icon: Users, label: "Friends", badge: pendingRequests, onClick: () => setShowFriends(true) },
    { id: "help", icon: HelpCircle, label: "Help & Support" },
    { id: "settings", icon: Settings, label: "Settings", onClick: () => setShowSettings(true) },
  ];

  const filteredFriends = mockFriends.filter(f => 
    f.name.toLowerCase().includes(friendSearch.toLowerCase())
  );

  const getStatusColor = (status: Friend["status"]) => {
    switch (status) {
      case "online": return "bg-green-500";
      case "playing": return "bg-orange-500 animate-pulse";
      case "offline": return "bg-slate-500";
    }
  };

  return (
    <>
      <aside className="fixed left-0 top-0 bottom-0 w-16 lg:w-64 bg-surface-card border-r border-border flex flex-col z-40">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-black text-surface">FPL</span>
            </div>
            <span className="hidden lg:block font-bold text-lg">Fantasy Premier League</span>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentScreen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
                  ${isActive 
                    ? "bg-accent/10 text-accent" 
                    : "text-text-muted hover:text-text hover:bg-white/5"
                  }
                `}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="hidden lg:block font-medium text-sm">{item.label}</span>
                {isActive && <div className="hidden lg:block ml-auto w-1.5 h-1.5 rounded-full bg-accent" />}
              </button>
            );
          })}
        </nav>

        <div className="p-2 border-t border-border space-y-1">
          {bottomItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={item.onClick || (() => {})}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-text-muted hover:text-text hover:bg-white/5 transition-all"
              >
                <div className="relative flex-shrink-0">
                  <Icon className="w-5 h-5" />
                  {item.badge && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-surface text-[10px] font-bold rounded-full flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="hidden lg:block font-medium text-sm">{item.label}</span>
              </button>
            );
          })}
          
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className="hidden lg:block font-medium text-sm">Logout</span>
          </button>
        </div>
      </aside>

      {showFriends && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowFriends(false)}>
          <div 
            className="card p-0 w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold">Friends</h2>
              <button onClick={() => setShowFriends(false)} className="p-1 hover:bg-white/5 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 border-b border-border space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type="text"
                    placeholder="Search friends..."
                    value={friendSearch}
                    onChange={e => setFriendSearch(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 bg-surface border border-border rounded-xl text-sm focus:border-accent outline-none"
                  />
                </div>
                <button className="h-10 px-3 bg-accent/10 text-accent rounded-xl hover:bg-accent/20 transition-colors">
                  <UserPlus className="w-4 h-4" />
                </button>
              </div>
              
              {pendingRequests > 0 && (
                <div className="p-3 rounded-xl bg-accent/10 border border-accent/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-accent" />
                      <span className="text-sm font-medium">{pendingRequests} pending friend requests</span>
                    </div>
                    <button className="text-xs text-accent font-bold hover:underline">View</button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              <div className="space-y-1">
                {filteredFriends.map(friend => (
                  <div 
                    key={friend.id}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-sm font-bold text-accent">
                        {friend.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface-card ${getStatusColor(friend.status)}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{friend.name}</p>
                      <p className="text-xs text-text-muted">
                        {friend.status === "playing" ? "In a contest" : friend.status === "online" ? "Online" : "Offline"} • Lv.{friend.level}
                      </p>
                    </div>
                    <button className="p-2 hover:bg-accent/10 rounded-lg transition-colors text-text-muted hover:text-accent">
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowSettings(false)}>
          <div 
            className="card p-0 w-full max-w-md overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold">Settings</h2>
              <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-white/5 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">Preferences</h3>
                
                <div className="flex items-center justify-between p-3 rounded-xl bg-surface-elevated">
                  <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-text-muted" />
                    <span className="text-sm font-medium">Push Notifications</span>
                  </div>
                  <button className="w-11 h-6 bg-accent rounded-full relative">
                    <div className="absolute right-0.5 top-0.5 w-5 h-5 bg-white rounded-full" />
                  </button>
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-xl bg-surface-elevated">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-text-muted" />
                    <span className="text-sm font-medium">Email Updates</span>
                  </div>
                  <button className="w-11 h-6 bg-surface border border-border rounded-full relative">
                    <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-text-muted rounded-full" />
                  </button>
                </div>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">Account</h3>
                
                <button className="w-full flex items-center justify-between p-3 rounded-xl bg-surface-elevated hover:bg-white/5 transition-colors">
                  <span className="text-sm font-medium">Change Password</span>
                  <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                
                <button className="w-full flex items-center justify-between p-3 rounded-xl bg-surface-elevated hover:bg-white/5 transition-colors">
                  <span className="text-sm font-medium">Privacy Settings</span>
                  <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              
              <div className="pt-4 border-t border-border">
                <button className="w-full p-3 rounded-xl bg-red-500/10 text-red-400 font-medium text-sm hover:bg-red-500/20 transition-colors">
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}