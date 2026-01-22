import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Send, FileText, CheckCircle, Clock, AlertCircle, Upload, Plus, Check, X, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";

export default function ResponseWorkspace() {
  const { id } = useParams<{ id: string }>();
  const requestId = parseInt(id || "0");
  
  const [, navigate] = useLocation();
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);

  // Get or create workspace
  const { data: request, isLoading: requestLoading } = trpc.requests.get.useQuery({ requestId });
  
  const createWorkspace = trpc.requests.workspaces.create.useMutation({
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Get or create workspace on mount
  const [workspaceId, setWorkspaceId] = useState<number | null>(null);
  
  // Create workspace when request is loaded and user is recipient
  const createWorkspaceMutation = trpc.requests.workspaces.create.useMutation({
    onSuccess: (result) => {
      if (result.workspaceId) {
        setWorkspaceId(result.workspaceId);
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  // Auto-create workspace when request loads
  if (request?.isRecipient && !workspaceId && !createWorkspaceMutation.isPending) {
    createWorkspaceMutation.mutate({ requestId });
  }


  const { data: workspace, isLoading: workspaceLoading, refetch: refetchWorkspace } = trpc.requests.workspaces.get.useQuery(
    { workspaceId: workspaceId! },
    { enabled: !!workspaceId }
  );

  const { data: validation } = trpc.requests.workspaces.validate.useQuery(
    { workspaceId: workspaceId! },
    { enabled: !!workspaceId }
  );

  const { data: signOffStatus } = trpc.requests.signOffs.checkComplete.useQuery(
    { workspaceId: workspaceId!, requestId },
    { enabled: !!workspaceId }
  );

  // Mutations
  const saveAnswer = trpc.requests.workspaces.saveAnswer.useMutation({
    onSuccess: () => {
      toast.success("Answer saved successfully.");
      refetchWorkspace();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const uploadDocument = trpc.requests.workspaces.uploadDocument.useMutation({
    onSuccess: () => {
      toast.success("Document uploaded successfully.");
      refetchWorkspace();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const submitWorkspace = trpc.requests.submissions.submit.useMutation({
    onSuccess: (result) => {
      toast.success("Your response has been submitted successfully.");
      setShowSubmitDialog(false);
      navigate(`/submissions/${result.submissionId}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const signOff = trpc.requests.signOffs.sign.useMutation({
    onSuccess: () => {
      toast.success("Sign-off recorded.");
      refetchWorkspace();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const isLoading = requestLoading || workspaceLoading;

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

  if (!request.isRecipient) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-medium mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">You are not a recipient of this request.</p>
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

  const schema = request.schema?.schemaJson;
  const requirements = schema?.items || [];
  const answers = workspace?.answers || [];
  const documents = workspace?.documents || [];

  // Calculate progress
  const totalItems = requirements.length;
  const completedItems = validation?.isComplete ? totalItems : 
    totalItems - (validation?.missingFields?.length || 0) - (validation?.missingDocs?.length || 0);
  const progress = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  const canSubmit = validation?.isComplete && signOffStatus;

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
              <Badge variant="secondary">Responding</Badge>
            </div>
            {request.instructions && (
              <p className="text-muted-foreground ml-10">{request.instructions}</p>
            )}
            {request.deadlineAt && (
              <p className="text-sm text-amber-500 ml-10 flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Due {new Date(request.deadlineAt).toLocaleDateString()}
              </p>
            )}
          </div>
          <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
            <DialogTrigger asChild>
              <Button disabled={!canSubmit}>
                <Send className="h-4 w-4 mr-2" />
                Submit Response
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Submit Response</DialogTitle>
                <DialogDescription>
                  Are you sure you want to submit your response? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div className="flex items-center gap-2 text-sm">
                  {validation?.isComplete ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                  )}
                  <span>All required fields: {validation?.isComplete ? "Complete" : "Incomplete"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm mt-2">
                  {signOffStatus ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                  )}
                  <span>Sign-offs: {signOffStatus ? "Complete" : "Pending"}</span>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => workspaceId && submitWorkspace.mutate({ workspaceId })}
                  disabled={submitWorkspace.isPending || !canSubmit}
                >
                  {submitWorkspace.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Confirm Submit
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Progress */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{completedItems} of {totalItems} items completed</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
            {validation && !validation.isComplete && (
              <div className="mt-4 space-y-2">
                {validation.missingFields?.length > 0 && (
                  <div className="text-sm text-amber-500">
                    <span className="font-medium">Missing fields:</span> {validation.missingFields.join(", ")}
                  </div>
                )}
                {validation.missingDocs?.length > 0 && (
                  <div className="text-sm text-amber-500">
                    <span className="font-medium">Missing documents:</span> {validation.missingDocs.join(", ")}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Requirements */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Requirements</h2>
          
          {requirements.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No specific requirements defined for this request.</p>
                <p className="text-sm mt-2">You can upload any relevant documents below.</p>
              </CardContent>
            </Card>
          ) : (
            requirements.map((req: any, idx: number) => {
              const answer = answers.find((a: any) => a.requirementKey === req.key);
              const doc = documents.find((d: any) => d.requirementKey === req.key);
              const isComplete = answer || doc;

              return (
                <Card key={idx} className={isComplete ? "border-green-500/50" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 h-5 w-5 rounded-full flex items-center justify-center ${
                          isComplete ? "bg-green-500" : "bg-muted"
                        }`}>
                          {isComplete ? (
                            <Check className="h-3 w-3 text-white" />
                          ) : (
                            <span className="text-xs text-muted-foreground">{idx + 1}</span>
                          )}
                        </div>
                        <div>
                          <CardTitle className="text-base">{req.label}</CardTitle>
                          {req.description && (
                            <CardDescription>{req.description}</CardDescription>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{req.type}</Badge>
                        {req.required && <Badge variant="secondary">Required</Badge>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {req.type === "field" && (
                      <div className="space-y-2">
                        {req.dataType === "text" && (
                          <Textarea
                            placeholder={`Enter ${req.label.toLowerCase()}...`}
                            defaultValue={(answer?.answerJson as any)?.value || ""}
                            onBlur={(e) => {
                              if (workspaceId && e.target.value) {
                                saveAnswer.mutate({
                                  workspaceId,
                                  requirementKey: req.key,
                                  answerJson: { value: e.target.value },
                                });
                              }
                            }}
                          />
                        )}
                        {(req.dataType === "number" || req.dataType === "date") && (
                          <Input
                            type={req.dataType === "number" ? "number" : "date"}
                            placeholder={`Enter ${req.label.toLowerCase()}...`}
                            defaultValue={(answer?.answerJson as any)?.value || ""}
                            onBlur={(e) => {
                              if (workspaceId && e.target.value) {
                                saveAnswer.mutate({
                                  workspaceId,
                                  requirementKey: req.key,
                                  answerJson: { value: e.target.value },
                                });
                              }
                            }}
                          />
                        )}
                        {req.dataType === "boolean" && (
                          <div className="flex items-center gap-2">
                            <Checkbox
                              defaultChecked={(answer?.answerJson as any)?.value === true}
                              onCheckedChange={(checked) => {
                                if (workspaceId) {
                                  saveAnswer.mutate({
                                    workspaceId,
                                    requirementKey: req.key,
                                    answerJson: { value: checked },
                                  });
                                }
                              }}
                            />
                            <Label>Yes</Label>
                          </div>
                        )}
                      </div>
                    )}
                    {req.type === "document" && (
                      <div className="space-y-2">
                        {doc ? (
                          <div className="flex items-center gap-2 p-2 bg-muted rounded">
                            <FileText className="h-4 w-4" />
                            <span className="text-sm">{doc.fileName}</span>
                            <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={() => {
                              // In a real app, this would open a file picker
                              toast.info("File upload UI coming soon");
                            }}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Document
                          </Button>
                        )}
                      </div>
                    )}
                    {req.type === "attestation" && (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          defaultChecked={(answer?.answerJson as any)?.attested === true}
                          onCheckedChange={(checked) => {
                            if (workspaceId) {
                              saveAnswer.mutate({
                                workspaceId,
                                requirementKey: req.key,
                                answerJson: { attested: checked, attestedAt: new Date().toISOString() },
                              });
                            }
                          }}
                        />
                        <Label className="text-sm">{req.description || "I attest that the information provided is accurate"}</Label>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Sign-offs */}
        <Card>
          <CardHeader>
            <CardTitle>Sign-offs</CardTitle>
            <CardDescription>Required approvals before submission</CardDescription>
          </CardHeader>
          <CardContent>
            {workspace?.signOffs?.length ? (
              <div className="space-y-2">
                {workspace.signOffs.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">Requirement #{s.requirementId}</span>
                    <Badge variant={s.status === "approved" ? "default" : "destructive"}>
                      {s.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <p className="text-sm">No sign-offs required or all sign-offs complete</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
