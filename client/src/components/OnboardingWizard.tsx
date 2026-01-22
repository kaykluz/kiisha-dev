import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Zap,
  Building2,
  Users,
  FolderPlus,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  Plus,
  Trash2,
  Upload,
  Sun,
  Battery,
  Wind,
} from "lucide-react";

interface OnboardingWizardProps {
  onComplete: () => void;
  onSkip: () => void;
}

interface TeamMember {
  email: string;
  role: "admin" | "editor" | "reviewer" | "investor_viewer";
}

interface ProjectData {
  name: string;
  location: string;
  capacity: string;
  type: "solar_pv" | "bess" | "wind" | "hybrid";
  stage: "feasibility" | "development" | "construction" | "operations";
}

const steps = [
  { id: 1, title: "Welcome", icon: Zap },
  { id: 2, title: "Organization", icon: Building2 },
  { id: 3, title: "Team", icon: Users },
  { id: 4, title: "First Project", icon: FolderPlus },
  { id: 5, title: "Complete", icon: CheckCircle2 },
];

export function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [orgName, setOrgName] = useState("");
  const [orgIndustry, setOrgIndustry] = useState("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    { email: "", role: "editor" },
  ]);
  const [project, setProject] = useState<ProjectData>({
    name: "",
    location: "",
    capacity: "",
    type: "solar_pv",
    stage: "development",
  });

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleAddTeamMember = () => {
    setTeamMembers([...teamMembers, { email: "", role: "editor" }]);
  };

  const handleRemoveTeamMember = (index: number) => {
    setTeamMembers(teamMembers.filter((_, i) => i !== index));
  };

  const handleTeamMemberChange = (
    index: number,
    field: "email" | "role",
    value: string
  ) => {
    const updated = [...teamMembers];
    updated[index] = { ...updated[index], [field]: value };
    setTeamMembers(updated);
  };

  const handleComplete = () => {
    toast.success("Welcome to KIISHA! Your workspace is ready.");
    onComplete();
  };

  const handleSkipStep = () => {
    if (currentStep < 5) {
      handleNext();
    } else {
      handleComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-bg-base)]">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-[var(--color-brand-primary)] blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-[var(--color-semantic-info)] blur-3xl" />
      </div>

      {/* Main Container */}
      <div className="relative w-full max-w-2xl mx-4">
        {/* Skip Button */}
        <button
          onClick={onSkip}
          className="absolute -top-12 right-0 text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] flex items-center gap-1"
        >
          Skip setup <X className="w-4 h-4" />
        </button>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;

            return (
              <div key={step.id} className="flex items-center">
                <div
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full transition-all",
                    isActive && "bg-[var(--color-brand-primary)] text-white",
                    isCompleted && "bg-[var(--color-semantic-success)] text-white",
                    !isActive && !isCompleted && "bg-[var(--color-bg-surface)] text-[var(--color-text-tertiary)]"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "w-12 h-0.5 mx-2",
                      isCompleted ? "bg-[var(--color-semantic-success)]" : "bg-[var(--color-border-subtle)]"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Content Card */}
        <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-8 shadow-lg">
          {/* Step 1: Welcome */}
          {currentStep === 1 && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-[var(--color-brand-primary-muted)] flex items-center justify-center mx-auto mb-6">
                <Zap className="w-8 h-8 text-[var(--color-brand-primary)]" />
              </div>
              <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-3">
                Welcome to KIISHA
              </h1>
              <p className="text-[var(--color-text-secondary)] mb-8 max-w-md mx-auto">
                Your intelligent platform for managing renewable energy portfolios.
                Let's set up your workspace in just a few steps.
              </p>
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="p-4 rounded-lg bg-[var(--color-bg-surface-hover)]">
                  <Sun className="w-6 h-6 text-[var(--color-brand-primary)] mx-auto mb-2" />
                  <p className="text-sm text-[var(--color-text-secondary)]">Track Solar Assets</p>
                </div>
                <div className="p-4 rounded-lg bg-[var(--color-bg-surface-hover)]">
                  <Battery className="w-6 h-6 text-[var(--color-semantic-success)] mx-auto mb-2" />
                  <p className="text-sm text-[var(--color-text-secondary)]">Monitor BESS</p>
                </div>
                <div className="p-4 rounded-lg bg-[var(--color-bg-surface-hover)]">
                  <Wind className="w-6 h-6 text-[var(--color-semantic-info)] mx-auto mb-2" />
                  <p className="text-sm text-[var(--color-text-secondary)]">Manage Wind</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Organization */}
          {currentStep === 2 && (
            <div>
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
                Set up your organization
              </h2>
              <p className="text-[var(--color-text-secondary)] mb-6">
                Tell us about your company to personalize your experience.
              </p>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="orgName" className="text-sm font-medium">
                    Organization Name
                  </Label>
                  <Input
                    id="orgName"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g., Cloudbreak Energy"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="orgIndustry" className="text-sm font-medium">
                    Industry Focus
                  </Label>
                  <Select value={orgIndustry} onValueChange={setOrgIndustry}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select your industry" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solar_developer">Solar Developer</SelectItem>
                      <SelectItem value="ipg">Independent Power Producer</SelectItem>
                      <SelectItem value="utility">Utility Company</SelectItem>
                      <SelectItem value="epc">EPC Contractor</SelectItem>
                      <SelectItem value="investor">Infrastructure Investor</SelectItem>
                      <SelectItem value="asset_manager">Asset Manager</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Organization Logo</Label>
                  <div className="mt-1.5 border-2 border-dashed border-[var(--color-border-subtle)] rounded-lg p-6 text-center hover:border-[var(--color-brand-primary)] transition-colors cursor-pointer">
                    <Upload className="w-8 h-8 text-[var(--color-text-tertiary)] mx-auto mb-2" />
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                      PNG, JPG up to 2MB
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Team */}
          {currentStep === 3 && (
            <div>
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
                Invite your team
              </h2>
              <p className="text-[var(--color-text-secondary)] mb-6">
                Add team members to collaborate on your projects.
              </p>
              <div className="space-y-3">
                {teamMembers.map((member, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Input
                      type="email"
                      value={member.email}
                      onChange={(e) =>
                        handleTeamMemberChange(index, "email", e.target.value)
                      }
                      placeholder="colleague@company.com"
                      className="flex-1"
                    />
                    <Select
                      value={member.role}
                      onValueChange={(value) =>
                        handleTeamMemberChange(index, "role", value)
                      }
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="reviewer">Reviewer</SelectItem>
                        <SelectItem value="investor_viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    {teamMembers.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveTeamMember(index)}
                        className="text-[var(--color-text-tertiary)] hover:text-[var(--color-semantic-error)]"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                onClick={handleAddTeamMember}
                className="mt-4 text-[var(--color-brand-primary)]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add another member
              </Button>
              <div className="mt-6 p-4 rounded-lg bg-[var(--color-bg-surface-hover)]">
                <h4 className="text-sm font-medium mb-2">Role Permissions</h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-[var(--color-text-secondary)]">
                  <div><Badge variant="outline" className="mr-2">Admin</Badge>Full access</div>
                  <div><Badge variant="outline" className="mr-2">Editor</Badge>Edit projects</div>
                  <div><Badge variant="outline" className="mr-2">Reviewer</Badge>Review & approve</div>
                  <div><Badge variant="outline" className="mr-2">Viewer</Badge>Read-only</div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: First Project */}
          {currentStep === 4 && (
            <div>
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
                Create your first project
              </h2>
              <p className="text-[var(--color-text-secondary)] mb-6">
                Add a project to get started with KIISHA.
              </p>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="projectName" className="text-sm font-medium">
                    Project Name
                  </Label>
                  <Input
                    id="projectName"
                    value={project.name}
                    onChange={(e) =>
                      setProject({ ...project, name: e.target.value })
                    }
                    placeholder="e.g., MA - Gillette BTM"
                    className="mt-1.5"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="projectLocation" className="text-sm font-medium">
                      Location
                    </Label>
                    <Input
                      id="projectLocation"
                      value={project.location}
                      onChange={(e) =>
                        setProject({ ...project, location: e.target.value })
                      }
                      placeholder="e.g., Massachusetts"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="projectCapacity" className="text-sm font-medium">
                      Capacity (MW)
                    </Label>
                    <Input
                      id="projectCapacity"
                      value={project.capacity}
                      onChange={(e) =>
                        setProject({ ...project, capacity: e.target.value })
                      }
                      placeholder="e.g., 12.5"
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Project Type</Label>
                    <Select
                      value={project.type}
                      onValueChange={(value: ProjectData["type"]) =>
                        setProject({ ...project, type: value })
                      }
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solar_pv">Solar PV</SelectItem>
                        <SelectItem value="bess">Battery Storage</SelectItem>
                        <SelectItem value="wind">Wind</SelectItem>
                        <SelectItem value="hybrid">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Stage</Label>
                    <Select
                      value={project.stage}
                      onValueChange={(value: ProjectData["stage"]) =>
                        setProject({ ...project, stage: value })
                      }
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="feasibility">Feasibility</SelectItem>
                        <SelectItem value="development">Development</SelectItem>
                        <SelectItem value="construction">Construction</SelectItem>
                        <SelectItem value="operations">Operations</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Complete */}
          {currentStep === 5 && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-[var(--color-semantic-success-muted)] flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-[var(--color-semantic-success)]" />
              </div>
              <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-3">
                You're all set!
              </h1>
              <p className="text-[var(--color-text-secondary)] mb-8 max-w-md mx-auto">
                Your workspace is ready. Here's what you can do next:
              </p>
              <div className="space-y-3 text-left max-w-sm mx-auto">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--color-bg-surface-hover)]">
                  <div className="w-6 h-6 rounded-full bg-[var(--color-brand-primary-muted)] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-medium text-[var(--color-brand-primary)]">1</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Upload documents</p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">Add contracts, permits, and technical docs</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--color-bg-surface-hover)]">
                  <div className="w-6 h-6 rounded-full bg-[var(--color-brand-primary-muted)] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-medium text-[var(--color-brand-primary)]">2</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Track RFIs</p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">Create and manage action items</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--color-bg-surface-hover)]">
                  <div className="w-6 h-6 rounded-full bg-[var(--color-brand-primary-muted)] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-medium text-[var(--color-brand-primary)]">3</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Monitor operations</p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">Connect data sources for real-time insights</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-[var(--color-border-subtle)]">
            <div>
              {currentStep > 1 && currentStep < 5 && (
                <Button variant="ghost" onClick={handleBack}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {currentStep < 5 && (
                <Button variant="ghost" onClick={handleSkipStep}>
                  Skip
                </Button>
              )}
              {currentStep < 5 ? (
                <Button className="btn-primary" onClick={handleNext}>
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button className="btn-primary" onClick={handleComplete}>
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
