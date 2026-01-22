/**
 * Admin Identity Management Page
 * 
 * Provides admin UI for:
 * - Managing user identifiers (verify/revoke)
 * - Viewing and claiming quarantined inbound messages
 * - Linking identifiers to users
 */

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { 
  Shield, 
  UserCheck, 
  UserX, 
  Mail, 
  Phone, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Inbox,
  Link as LinkIcon
} from 'lucide-react';

export default function AdminIdentity() {

  const [selectedTab, setSelectedTab] = useState('identifiers');
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [selectedInbound, setSelectedInbound] = useState<any>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // Fetch data
  const { data: identifiers, refetch: refetchIdentifiers } = trpc.identity.listIdentifiers.useQuery();
  const { data: quarantined, refetch: refetchQuarantined } = trpc.identity.listQuarantined.useQuery();
  const { data: users } = trpc.users.list.useQuery();

  // Mutations
  const verifyIdentifier = trpc.identity.verifyIdentifier.useMutation({
    onSuccess: () => {
      toast.success('Identifier verified');
      refetchIdentifiers();
    },
    onError: (err) => toast.error('Error', { description: err.message }),
  });

  const revokeIdentifier = trpc.identity.revokeIdentifier.useMutation({
    onSuccess: () => {
      toast.success('Identifier revoked');
      refetchIdentifiers();
    },
    onError: (err) => toast.error('Error', { description: err.message }),
  });

  const claimInbound = trpc.identity.claimInbound.useMutation({
    onSuccess: () => {
      toast.success('Message claimed and linked to user');
      refetchQuarantined();
      setClaimDialogOpen(false);
      setSelectedInbound(null);
      setSelectedUserId('');
    },
    onError: (err) => toast.error('Error', { description: err.message }),
  });

  const rejectInbound = trpc.identity.rejectInbound.useMutation({
    onSuccess: () => {
      toast.success('Message rejected');
      refetchQuarantined();
    },
    onError: (err) => toast.error('Error', { description: err.message }),
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-green-500/20 text-green-400"><CheckCircle className="w-3 h-3 mr-1" />Verified</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-400"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'revoked':
        return <Badge className="bg-red-500/20 text-red-400"><XCircle className="w-3 h-3 mr-1" />Revoked</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email':
        return <Mail className="w-4 h-4" />;
      case 'whatsapp':
      case 'phone':
        return <Phone className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6" />
              Identity Management
            </h1>
            <p className="text-muted-foreground">
              Manage user identifiers and quarantined messages
            </p>
          </div>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList>
            <TabsTrigger value="identifiers" className="flex items-center gap-2">
              <UserCheck className="w-4 h-4" />
              User Identifiers
              {identifiers && <Badge variant="secondary" className="ml-1">{identifiers.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="quarantine" className="flex items-center gap-2">
              <Inbox className="w-4 h-4" />
              Quarantine
              {quarantined && quarantined.length > 0 && (
                <Badge variant="destructive" className="ml-1">{quarantined.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* User Identifiers Tab */}
          <TabsContent value="identifiers" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Registered Identifiers</CardTitle>
                <CardDescription>
                  Phone numbers and email addresses linked to user accounts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Identifier</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Organization</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {identifiers?.map((id: any) => (
                      <TableRow key={id.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getChannelIcon(id.identifierType)}
                            <span className="capitalize">{id.identifierType}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">{id.identifierValue}</TableCell>
                        <TableCell>{id.userName || `User #${id.userId}`}</TableCell>
                        <TableCell>{id.organizationName || '-'}</TableCell>
                        <TableCell>{getStatusBadge(id.status)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(id.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {id.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => verifyIdentifier.mutate({ identifierId: id.id })}
                              disabled={verifyIdentifier.isPending}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Verify
                            </Button>
                          )}
                          {id.status === 'verified' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-400 hover:text-red-300"
                              onClick={() => revokeIdentifier.mutate({ identifierId: id.id })}
                              disabled={revokeIdentifier.isPending}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Revoke
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!identifiers || identifiers.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No identifiers registered yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Quarantine Tab */}
          <TabsContent value="quarantine" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  Quarantined Messages
                </CardTitle>
                <CardDescription>
                  Messages from unknown senders awaiting admin review
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Channel</TableHead>
                      <TableHead>Sender</TableHead>
                      <TableHead>Message Preview</TableHead>
                      <TableHead>Received</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quarantined?.map((msg: any) => (
                      <TableRow key={msg.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getChannelIcon(msg.channel)}
                            <span className="capitalize">{msg.channel}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-mono text-sm">{msg.senderIdentifier}</div>
                            {msg.senderDisplayName && (
                              <div className="text-xs text-muted-foreground">{msg.senderDisplayName}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {msg.textContent || <span className="text-muted-foreground italic">No text content</span>}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(msg.receivedAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(msg.expiresAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Dialog open={claimDialogOpen && selectedInbound?.id === msg.id} onOpenChange={(open) => {
                            setClaimDialogOpen(open);
                            if (!open) {
                              setSelectedInbound(null);
                              setSelectedUserId('');
                            }
                          }}>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedInbound(msg)}
                              >
                                <LinkIcon className="w-4 h-4 mr-1" />
                                Claim
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Claim Message</DialogTitle>
                                <DialogDescription>
                                  Link this message to an existing user account
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label>Sender</Label>
                                  <div className="font-mono text-sm p-2 bg-muted rounded">
                                    {msg.senderIdentifier}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label>Link to User</Label>
                                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select a user..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {users?.map((user: any) => (
                                        <SelectItem key={user.id} value={user.id.toString()}>
                                          {user.name || user.email || `User #${user.id}`}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setClaimDialogOpen(false)}>
                                  Cancel
                                </Button>
                                <Button
                                  onClick={() => claimInbound.mutate({
                                    inboundId: msg.id,
                                    userId: parseInt(selectedUserId),
                                    createIdentifier: true,
                                  })}
                                  disabled={!selectedUserId || claimInbound.isPending}
                                >
                                  Claim & Link
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-400 hover:text-red-300"
                            onClick={() => rejectInbound.mutate({ inboundId: msg.id })}
                            disabled={rejectInbound.isPending}
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!quarantined || quarantined.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          No quarantined messages
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
