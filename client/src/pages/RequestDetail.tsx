import { useState } from "react";
import { useParams, Link } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Send, Users, FileText, CheckCircle, Clock, AlertCircle, Plus, Mail, Phone, Building, Eye, MessageSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function RequestDetail() {
  const { id } = useParams<{ id: string }>();
  const requestId = parseInt(id || "0");
  
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteData, setInviteData] = useState({
    type: "email" as "email" | "phone" | "org",
    email: "",
    phone: "",
    orgId: "",
  });

  // Queries
  const { data: request, isLoading, refetch } = trpc.requests.get.useQuery({ requestId });
  const { data: submissions = [] } = trpc.requests.submissions.listForRequest.useQuery(
    { requestId },
    { enabled: request?.isIssuer === true }
  );
  const { data: clarifications = [] } = trpc.requests.clarifications.list.useQuery({ requestId });
  const { data: auditLog = [] } = trpc.requests.auditLog.useQuery(
    { requestId },
    { enabled: request?.isIssuer === true }
  );

  // Mutations
  const issueRequest = trpc.requests.issue.useMutation({
    onSuccess: () => {
      toast.success("Request issued - Recipients have been notified.");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const inviteRecipient = trpc.requests.recipients.invite.useMutation({
    onSuccess: () => {
      toast.success("Recipient invited - An invitation has been sent.");
      setShowInviteDialog(false);
      setInviteData({ type: "email", email: "", phone: "", orgId: "" });
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const reviewSubmission = trpc.requests.submissions.review.useMutation({
    onSuccess: () => {
      toast.success("Submission reviewed - Status updated.");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleInvite = () => {
    const data: any = { requestId };
    if (inviteData.type === "email" && inviteData.email) {
      data.recipientEmail = inviteData.email;
    } else if (inviteData.type === "phone" && inviteData.phone) {
      data.recipientPhone = inviteData.phone;
    } else if (inviteData.type === "org" && inviteData.orgId) {
      data.recipientOrgId = parseInt(inviteData.orgId);
    } else {
      toast.error("Please provide recipient details");
      return;
    }
    inviteRecipient.mutate(data);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary"><FileText className="h-3 w-3 mr-1" />Draft</Badge>;
      case "issued":
        return <Badge variant="default" className="bg-blue-500"><Send className="h-3 w-3 mr-1" />Issued</Badge>;
      case "in_progress":
        return <Badge variant="default" className="bg-amber-500"><Clock className="h-3 w-3 mr-1" />In Progress</Badge>;
      case "completed":
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case "cancelled":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRecipientStatusBadge = (status: string) => {
    switch (status) {
      case "invited":
        return <Badge variant="outline">Invited</Badge>;
      case "opened":
        return <Badge variant="secondary">Opened</Badge>;
      case "responding":
        return <Badge variant="default" className="bg-amber-500">Responding</Badge>;
      case "submitted":
        return <Badge variant="default" className="bg-green-500">Submitted</Badge>;
      case "declined":
        return <Badge variant="destructive">Declined</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!request) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-medium mb-2">Request not found</h2>
          <Button asChild variant="outline">
            <Link href="/requests">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Requests
            </Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/requests">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <h1 className="text-2xl font-bold">{request.title}</h1>
              {getStatusBadge(request.status)}
            </div>
            {request.instructions && (
              <p className="text-muted-foreground ml-10">{request.instructions}</p>
            )}
            <div className="flex items-center gap-4 text-sm text-muted-foreground ml-10">
              <span>Created {new Date(request.createdAt).toLocaleDateString()}</span>
              {request.deadlineAt && (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Due {new Date(request.deadlineAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {request.isIssuer && request.status === "draft" && (
              <Button
                onClick={() => issueRequest.mutate({ requestId })}
                disabled={issueRequest.isPending}
              >
                <Send className="h-4 w-4 mr-2" />
                Issue Request
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {request.isIssuer && (
              <>
                <TabsTrigger value="recipients">
                  <Users className="h-4 w-4 mr-2" />
                  Recipients ({request.recipients?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="submissions">
                  <FileText className="h-4 w-4 mr-2" />
                  Submissions ({submissions.length})
                </TabsTrigger>
                <TabsTrigger value="clarifications">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Clarifications ({clarifications.length})
                </TabsTrigger>
                <TabsTrigger value="audit">Audit Log</TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Request Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Title</Label>
                    <p className="font-medium">{request.title}</p>
                  </div>
                  {request.instructions && (
                    <div>
                      <Label className="text-muted-foreground">Instructions</Label>
                      <p>{request.instructions}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <div className="mt-1">{getStatusBadge(request.status)}</div>
                  </div>
                  {request.deadlineAt && (
                    <div>
                      <Label className="text-muted-foreground">Deadline</Label>
                      <p>{new Date(request.deadlineAt).toLocaleString()}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {request.schema && (
                <Card>
                  <CardHeader>
                    <CardTitle>Requirements</CardTitle>
                    <CardDescription>
                      {request.schema.schemaJson?.items?.length || 0} items required
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {request.schema.schemaJson?.items?.map((item: any, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Badge variant="outline" className="mt-0.5">
                            {item.type}
                          </Badge>
                          <div>
                            <p className="font-medium">{item.label}</p>
                            {item.description && (
                              <p className="text-sm text-muted-foreground">{item.description}</p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {request.isIssuer && (
            <>
              <TabsContent value="recipients" className="mt-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Recipients</CardTitle>
                      <CardDescription>Manage who can respond to this request</CardDescription>
                    </div>
                    <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Invite Recipient
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Invite Recipient</DialogTitle>
                          <DialogDescription>
                            Send an invitation to respond to this request.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Invite by</Label>
                            <Select
                              value={inviteData.type}
                              onValueChange={(v) => setInviteData({ ...inviteData, type: v as any })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="email">
                                  <div className="flex items-center gap-2">
                                    <Mail className="h-4 w-4" />
                                    Email
                                  </div>
                                </SelectItem>
                                <SelectItem value="phone">
                                  <div className="flex items-center gap-2">
                                    <Phone className="h-4 w-4" />
                                    Phone
                                  </div>
                                </SelectItem>
                                <SelectItem value="org">
                                  <div className="flex items-center gap-2">
                                    <Building className="h-4 w-4" />
                                    Organization
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {inviteData.type === "email" && (
                            <div className="space-y-2">
                              <Label>Email Address</Label>
                              <Input
                                type="email"
                                placeholder="recipient@example.com"
                                value={inviteData.email}
                                onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                              />
                            </div>
                          )}
                          {inviteData.type === "phone" && (
                            <div className="space-y-2">
                              <Label>Phone Number</Label>
                              <Input
                                type="tel"
                                placeholder="+1234567890"
                                value={inviteData.phone}
                                onChange={(e) => setInviteData({ ...inviteData, phone: e.target.value })}
                              />
                            </div>
                          )}
                          {inviteData.type === "org" && (
                            <div className="space-y-2">
                              <Label>Organization ID</Label>
                              <Input
                                type="number"
                                placeholder="Enter organization ID"
                                value={inviteData.orgId}
                                onChange={(e) => setInviteData({ ...inviteData, orgId: e.target.value })}
                              />
                            </div>
                          )}
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                            Cancel
                          </Button>
                          <Button onClick={handleInvite} disabled={inviteRecipient.isPending}>
                            {inviteRecipient.isPending ? "Sending..." : "Send Invitation"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent>
                    {!request.recipients?.length ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No recipients invited yet</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Recipient</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Invited</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {request.recipients.map((recipient: any) => (
                            <TableRow key={recipient.id}>
                              <TableCell>
                                {recipient.recipientEmail || recipient.recipientPhone || `Org #${recipient.recipientOrgId}`}
                              </TableCell>
                              <TableCell>{getRecipientStatusBadge(recipient.status)}</TableCell>
                              <TableCell>{new Date(recipient.invitedAt).toLocaleDateString()}</TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="submissions" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Submissions</CardTitle>
                    <CardDescription>Review responses from recipients</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {submissions.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No submissions received yet</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Submitted By</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Submitted</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {submissions.map((submission: any) => (
                            <TableRow key={submission.id}>
                              <TableCell>Org #{submission.recipientOrgId}</TableCell>
                              <TableCell>
                                <Badge variant={
                                  submission.status === "accepted" ? "default" :
                                  submission.status === "rejected" ? "destructive" :
                                  "secondary"
                                }>
                                  {submission.status}
                                </Badge>
                              </TableCell>
                              <TableCell>{new Date(submission.submittedAt).toLocaleDateString()}</TableCell>
                              <TableCell className="space-x-2">
                                <Button variant="outline" size="sm" asChild>
                                  <Link href={`/submissions/${submission.id}`}>
                                    <Eye className="h-4 w-4 mr-1" />
                                    View
                                  </Link>
                                </Button>
                                {submission.status === "pending" && (
                                  <>
                                    <Button
                                      size="sm"
                                      onClick={() => reviewSubmission.mutate({
                                        submissionId: submission.id,
                                        status: "accepted",
                                      })}
                                    >
                                      Accept
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => reviewSubmission.mutate({
                                        submissionId: submission.id,
                                        status: "rejected",
                                      })}
                                    >
                                      Reject
                                    </Button>
                                  </>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="clarifications" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Clarifications</CardTitle>
                    <CardDescription>Questions and answers about this request</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {clarifications.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No clarifications yet</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {clarifications.map((c: any) => (
                          <div key={c.id} className="border rounded-lg p-4">
                            <div className="flex items-start justify-between mb-2">
                              <Badge variant="outline">{c.status}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(c.createdAt).toLocaleString()}
                              </span>
                            </div>
                            {c.subject && <p className="font-medium mb-1">{c.subject}</p>}
                            <p className="text-sm">{c.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="audit" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Audit Log</CardTitle>
                    <CardDescription>Complete history of actions on this request</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {auditLog.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No audit entries yet</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {auditLog.map((entry: any) => (
                          <div key={entry.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                            <div className="flex-1">
                              <p className="text-sm font-medium">{entry.eventType.replace(/_/g, " ")}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(entry.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
