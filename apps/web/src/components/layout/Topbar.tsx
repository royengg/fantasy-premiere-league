import { User } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ModeToggle } from "../ModeToggle"

interface TopbarProps {
  username: string
  level: number
  onSwitchAccount: () => void
}

export function Topbar({ username, level, onSwitchAccount }: TopbarProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="font-bold text-primary-foreground text-lg italic">F</span>
          </div>
          <div className="hidden md:flex flex-col">
            <span className="text-xs font-semibold tracking-widest text-primary uppercase">
              Fantasy Club
            </span>
            <span className="text-sm font-semibold text-foreground leading-none">
              Season 1
            </span>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-end space-x-4">
          <nav className="flex items-center space-x-2">
            <div className="hidden md:flex items-center gap-3 mr-4 border-r border-border pr-6">
              <div className="flex flex-col items-end">
                <span className="text-sm font-bold">{username}</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  Level {level}
                </span>
              </div>
              <div className="h-9 w-9 rounded-full bg-secondary/20 border border-secondary/50 flex items-center justify-center text-secondary">
                <User size={18} />
              </div>
            </div>
            
            <ModeToggle />
            
            <Button
              variant="outline"
              size="sm"
              onClick={onSwitchAccount}
              className="text-muted-foreground hover:text-foreground hidden sm:flex"
            >
              Switch Account
            </Button>
          </nav>
        </div>
      </div>
    </header>
  )
}
