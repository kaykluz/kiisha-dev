/**
 * Conversation History View
 * 
 * Shows past WhatsApp/email conversations per user with:
 * - Context pointers (last referenced project, site, asset, document)
 * - Resolved entities
 * - Message history with timestamps
 */

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { 
  MessageSquare, 
  Mail, 
  Phone, 
  User,
  FileText,
  Building,
  MapPin,
  Clock,
  Search,
  RefreshCw,
  ChevronRight,
  Bot,
  UserCircle
} from 'lucide-react';

export default function ConversationHistory() {
  const [selectedUserId, setSelectedUserId] = useState<string>('_all');
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch users list
  const { data: users } = trpc.users.list.useQuery();

  // Fetch conversation sessions
  const { data: sessions, refetch: refetchSessions } = trpc.whatsapp.getSessions.useQuery(
    { 
      userId: selectedUserId && selectedUserId !== '_all' ? parseInt(selectedUserId) : undefined, 
      channel: selectedChannel !== 'all' ? (selectedChannel as 'whatsapp' | 'email') : undefined 
    },
    { enabled: true }
  );

  // Fetch messages for selected session
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const { data: messages } = trpc.whatsapp.getSessionMessages.useQuery(
    { sessionId: selectedSessionId! },
    { enabled: !!selectedSessionId }
  );

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email':
        return <Mail className="w-4 h-4" />;
      case 'whatsapp':
        return <Phone className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const formatTimestamp = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString();
  };

  const formatRelativeTime = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageSquare className="w-6 h-6" />
              Conversation History
            </h1>
            <p className="text-muted-foreground">
              View past WhatsApp and email conversations with context
            </p>
          </div>
          <Button variant="outline" onClick={() => refetchSessions()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="flex gap-4">
          {/* Filters */}
          <div className="flex gap-2">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All users</SelectItem>
                {users?.map((user: any) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.name || user.email || `User #${user.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedChannel} onValueChange={setSelectedChannel}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All channels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Sessions List */}
          <div className="col-span-4">
            <Card className="h-[calc(100vh-280px)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Sessions</CardTitle>
                <CardDescription>
                  {sessions?.length || 0} conversation sessions
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-380px)]">
                  {sessions?.map((session: any) => (
                    <div
                      key={session.id}
                      className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedSessionId === session.id ? 'bg-muted' : ''
                      }`}
                      onClick={() => setSelectedSessionId(session.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {getChannelIcon(session.channel)}
                          <span className="font-medium text-sm">
                            {session.userName || `User #${session.userId}`}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {formatRelativeTime(session.lastActivityAt)}
                        </Badge>
                      </div>
                      
                      {/* Context Pointers */}
                      <div className="mt-2 space-y-1">
                        {session.lastReferencedProjectId && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Building className="w-3 h-3" />
                            <span>Project #{session.lastReferencedProjectId}</span>
                          </div>
                        )}
                        {session.lastReferencedDocumentId && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <FileText className="w-3 h-3" />
                            <span>Doc #{session.lastReferencedDocumentId}</span>
                          </div>
                        )}
                        {session.activeDataroomId && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="w-3 h-3" />
                            <span>Dataroom #{session.activeDataroomId}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!sessions || sessions.length === 0) && (
                    <div className="p-8 text-center text-muted-foreground">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No conversation sessions found</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Messages View */}
          <div className="col-span-8">
            <Card className="h-[calc(100vh-280px)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {selectedSessionId ? (
                    <>
                      <MessageSquare className="w-4 h-4" />
                      Conversation Messages
                    </>
                  ) : (
                    'Select a session'
                  )}
                </CardTitle>
                {selectedSessionId && (
                  <CardDescription>
                    Session #{selectedSessionId} • {messages?.length || 0} messages
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-380px)]">
                  {selectedSessionId && messages ? (
                    <div className="p-4 space-y-4">
                      {messages.map((msg: any, idx: number) => (
                        <div
                          key={idx}
                          className={`flex gap-3 ${
                            msg.role === 'assistant' ? 'flex-row' : 'flex-row-reverse'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            msg.role === 'assistant' ? 'bg-primary/20' : 'bg-muted'
                          }`}>
                            {msg.role === 'assistant' ? (
                              <Bot className="w-4 h-4" />
                            ) : (
                              <UserCircle className="w-4 h-4" />
                            )}
                          </div>
                          <div className={`max-w-[70%] ${
                            msg.role === 'assistant' ? '' : 'text-right'
                          }`}>
                            <div className={`rounded-lg p-3 ${
                              msg.role === 'assistant' 
                                ? 'bg-muted' 
                                : 'bg-primary text-primary-foreground'
                            }`}>
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {formatTimestamp(msg.timestamp)}
                              {msg.toolCalls && msg.toolCalls.length > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {msg.toolCalls.length} tool calls
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-muted-foreground">
                      <ChevronRight className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>Select a session to view messages</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
