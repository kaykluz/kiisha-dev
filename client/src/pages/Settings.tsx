import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { 
  Users, 
  MessageSquare, 
  Send, 
  Plug, 
  Shield, 
  Bell, 
  Key,
  Settings as SettingsIcon,
  ChevronRight,
  Globe,
  Database,
  Webhook,
  Mail,
  User
} from "lucide-react";

interface SettingsCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  adminOnly?: boolean;
}

function SettingsCard({ title, description, icon, path, badge, badgeVariant = "secondary", adminOnly }: SettingsCardProps) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  
  // Hide admin-only cards from non-admin users
  if (adminOnly && user?.role !== 'admin') {
    return null;
  }
  
  return (
    <Card 
      className="cursor-pointer hover:bg-accent/50 transition-colors group"
      onClick={() => setLocation(path)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              {icon}
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {title}
                {badge && (
                  <Badge variant={badgeVariant} className="text-xs">
                    {badge}
                  </Badge>
                )}
              </CardTitle>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <CardDescription>{description}</CardDescription>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/10">
            <SettingsIcon className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">
              {isAdmin 
                ? "Manage your account, integrations, and system configuration"
                : "Manage your account and preferences"
              }
            </p>
          </div>
        </div>

        {/* Account Section - Always visible */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Account</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <SettingsCard
              title="Profile"
              description="Update your profile information, avatar, and personal details."
              icon={<User className="h-5 w-5" />}
              path="/profile"
            />
            <SettingsCard
              title="Security"
              description="Manage your password, two-factor authentication, and login sessions."
              icon={<Shield className="h-5 w-5" />}
              path="/profile"
            />
            <SettingsCard
              title="Notifications"
              description="Configure your notification preferences and alert settings."
              icon={<Bell className="h-5 w-5" />}
              path="/profile"
              badge="Coming Soon"
              badgeVariant="outline"
            />
          </div>
        </div>

        {/* Communication & Channels Section - Admin only */}
        {isAdmin && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Communication & Channels</h2>
              <Badge variant="outline">Admin</Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <SettingsCard
                title="Identity Management"
                description="Manage user identifiers, verify identities, and handle quarantined messages from unknown senders."
                icon={<Users className="h-5 w-5" />}
                path="/admin/identity"
                adminOnly
              />
              <SettingsCard
                title="Conversations"
                description="View conversation history across WhatsApp, email, and other channels. Monitor agent interactions."
                icon={<MessageSquare className="h-5 w-5" />}
                path="/admin/conversations"
                adminOnly
              />
              <SettingsCard
                title="WhatsApp Templates"
                description="Manage Meta-approved WhatsApp Business templates and configure event-to-template mappings."
                icon={<Send className="h-5 w-5" />}
                path="/admin/whatsapp-templates"
                adminOnly
              />
            </div>
          </div>
        )}

        {/* Integrations Section - Admin only */}
        {isAdmin && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Integrations & Providers</h2>
              <Badge variant="outline">Admin</Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <SettingsCard
                title="Provider Integrations"
                description="Connect external services like AWS S3, OpenAI, SendGrid, and more. Configure API keys and webhooks."
                icon={<Plug className="h-5 w-5" />}
                path="/settings/integrations"
                badge="12 Providers"
                adminOnly
              />
              <SettingsCard
                title="Webhooks"
                description="Configure incoming webhooks for WhatsApp, email, and third-party integrations."
                icon={<Webhook className="h-5 w-5" />}
                path="/settings/integrations"
                badge="Coming Soon"
                badgeVariant="outline"
                adminOnly
              />
              <SettingsCard
                title="Email Configuration"
                description="Set up email providers for inbound message processing and notification delivery."
                icon={<Mail className="h-5 w-5" />}
                path="/settings/integrations"
                adminOnly
              />
            </div>
          </div>
        )}

        {/* System Section - Admin only */}
        {isAdmin && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">System Administration</h2>
              <Badge variant="outline">Admin</Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <SettingsCard
                title="Admin Ingest Simulator"
                description="Test document ingestion, categorization, and extraction pipelines with sample data."
                icon={<Database className="h-5 w-5" />}
                path="/admin/ingest"
                badge="Dev Tool"
                badgeVariant="outline"
                adminOnly
              />
              <SettingsCard
                title="API Keys"
                description="Manage API keys for programmatic access to KIISHA services."
                icon={<Key className="h-5 w-5" />}
                path="/settings/integrations"
                badge="Coming Soon"
                badgeVariant="outline"
                adminOnly
              />
              <SettingsCard
                title="Organization"
                description="Manage organization settings, team members, and access permissions."
                icon={<Globe className="h-5 w-5" />}
                path="/settings/integrations"
                badge="Coming Soon"
                badgeVariant="outline"
                adminOnly
              />
            </div>
          </div>
        )}

        {/* Quick Stats for Admins */}
        {isAdmin && (
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-base">System Overview</CardTitle>
              <CardDescription>Quick status of key system components</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="text-center p-4 rounded-lg bg-background">
                  <div className="text-2xl font-bold text-primary">30</div>
                  <div className="text-sm text-muted-foreground">Assets</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-background">
                  <div className="text-2xl font-bold text-green-500">Active</div>
                  <div className="text-sm text-muted-foreground">WhatsApp</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-background">
                  <div className="text-2xl font-bold text-yellow-500">Pending</div>
                  <div className="text-sm text-muted-foreground">Email Setup</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-background">
                  <div className="text-2xl font-bold text-blue-500">12</div>
                  <div className="text-sm text-muted-foreground">Integrations</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
