import { FormEvent, useState } from "react";
import { Plus, UserPlus, Users, Trophy, ShieldAlert, ShieldCheck, Key } from "lucide-react";

import type { League } from "@fantasy-cricket/types";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LeaguePanelProps {
  leagues: League[];
  onCreateLeague: (payload: {
    name: string;
    description?: string;
    visibility: "public" | "private";
  }) => Promise<unknown>;
  onJoinLeague: (inviteCode: string) => Promise<unknown>;
}

export function LeaguePanel({ leagues, onCreateLeague, onJoinLeague }: LeaguePanelProps) {
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setStatus(null);
    try {
      await onCreateLeague({
        name: createName,
        description: createDescription,
        visibility: "private"
      });
      setCreateName("");
      setCreateDescription("");
      setStatus({ message: "League created successfully!", type: 'success' });
    } catch (error) {
      setStatus({ message: error instanceof Error ? error.message : "Could not create league.", type: 'error' });
    }
  }

  async function handleJoin(event: FormEvent) {
    event.preventDefault();
    setStatus(null);
    try {
      await onJoinLeague(inviteCode);
      setStatus({ message: "Successfully joined the league!", type: 'success' });
      setInviteCode("");
    } catch (error) {
      setStatus({ message: error instanceof Error ? error.message : "Could not join league.", type: 'error' });
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-primary/5 p-6 rounded-3xl border border-primary/20">
        <div className="space-y-2">
          <Badge variant="outline" className="text-secondary border-secondary/30 uppercase tracking-widest text-[10px]">
            Social Hub
          </Badge>
          <h3 className="text-2xl md:text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
            <Trophy className="w-8 h-8 text-primary" />
            Friend Leagues
          </h3>
          <p className="text-muted-foreground mt-1 max-w-xl">
            Create private rooms, invite friends, and compete in exclusive fantasy ladders without the stress of public matchmaking.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Leagues List */}
        <div className="lg:col-span-8 space-y-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 px-2">
            <Users className="w-4 h-4" />
            Your Leagues
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {leagues.length === 0 ? (
              <Card className="md:col-span-2 glass-panel border-dashed border-white/20 bg-background/30">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Users className="w-8 h-8 text-primary opacity-80" />
                  </div>
                  <h3 className="text-lg font-bold">No Leagues Yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Join an existing league or create your own to start competing with friends.
                  </p>
                </CardContent>
              </Card>
            ) : (
              leagues.map((league) => (
                <Card key={league.id} className="glass-panel hover:border-primary/30 transition-colors group">
                  <CardHeader className="pb-3 border-b border-white/5 space-y-0 relative">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <CardTitle className="text-xl font-bold">{league.name}</CardTitle>
                        <CardDescription className="line-clamp-2 min-h-[40px]">
                          {league.description || "No description provided."}
                        </CardDescription>
                      </div>
                      <Badge variant={league.visibility === 'public' ? 'default' : 'secondary'} className="uppercase text-[10px]">
                        {league.visibility}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardFooter className="bg-black/20 p-4 flex justify-between items-center rounded-b-xl">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                      <Users className="w-4 h-4 text-primary" />
                      {league.memberIds.length} Managers
                    </div>
                    <div className="flex items-center gap-2 bg-background/50 px-3 py-1.5 rounded-lg border border-white/10 group-hover:border-primary/50 transition-colors">
                      <Key className="w-3.5 h-3.5 text-secondary" />
                      <code className="text-xs font-mono font-bold tracking-wider text-foreground">
                        {league.inviteCode}
                      </code>
                    </div>
                  </CardFooter>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Action Forms */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="glass-panel border-primary/20 bg-gradient-to-b from-primary/5 to-transparent relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[40px] -z-10" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Plus className="w-5 h-5 text-primary" />
                Create League
              </CardTitle>
              <CardDescription>Start a new private league</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="leagueName" className="text-xs font-bold uppercase text-muted-foreground ml-1">Name</Label>
                  <Input 
                    id="leagueName"
                    placeholder="e.g. Office Rivals" 
                    value={createName} 
                    onChange={(e) => setCreateName(e.target.value)}
                    className="bg-background/50 border-white/10"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leagueDesc" className="text-xs font-bold uppercase text-muted-foreground ml-1">Description</Label>
                  <Input 
                    id="leagueDesc"
                    placeholder="Short description..." 
                    value={createDescription} 
                    onChange={(e) => setCreateDescription(e.target.value)}
                    className="bg-background/50 border-white/10"
                  />
                </div>
                <Button type="submit" className="w-full font-bold glow-effect" disabled={!createName}>
                  Create League
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="glass-panel border-secondary/20 bg-gradient-to-b from-secondary/5 to-transparent relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 rounded-full blur-[40px] -z-10" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserPlus className="w-5 h-5 text-secondary" />
                Join League
              </CardTitle>
              <CardDescription>Enter code to join friends</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleJoin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="inviteCode" className="text-xs font-bold uppercase text-muted-foreground ml-1">Invite Code</Label>
                  <Input 
                    id="inviteCode"
                    placeholder="e.g. FRND2026" 
                    value={inviteCode} 
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    className="bg-background/50 border-white/10 font-mono tracking-widest uppercase"
                    required
                  />
                </div>
                <Button type="submit" variant="secondary" className="w-full font-bold shadow-[0_0_15px_rgba(248,160,79,0.3)] hover:shadow-[0_0_20px_rgba(248,160,79,0.4)] transition-all" disabled={!inviteCode}>
                  Join League
                </Button>
              </form>
            </CardContent>
          </Card>

          {status && (
            <div className={`p-4 rounded-xl text-sm font-medium flex items-center gap-3 border ${
              status.type === 'error' 
                ? "bg-destructive/10 text-destructive border-destructive/20" 
                : "bg-primary/10 text-primary border-primary/20"
            }`}>
              {status.type === 'error' ? <ShieldAlert className="w-5 h-5 shrink-0" /> : <ShieldCheck className="w-5 h-5 shrink-0" />}
              {status.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
