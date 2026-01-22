import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Link2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function CalendarIntegration() {
  const handleConnect = (provider: string) => {
    toast.info(`${provider} Calendar integration requires OAuth credentials to be configured. Please contact your administrator.`);
  };
  
  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Calendar Integration</h1>
            <p className="text-muted-foreground">Connect your calendar to sync obligations and deadlines</p>
          </div>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2">
          {/* Google Calendar */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Google Calendar
              </CardTitle>
              <CardDescription>
                Sync obligations and deadlines with your Google Calendar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertCircle className="w-5 h-5" />
                <span>Not connected</span>
              </div>
              <Button onClick={() => handleConnect("Google")}>
                <Link2 className="w-4 h-4 mr-2" />
                Connect Google Calendar
              </Button>
            </CardContent>
          </Card>
          
          {/* Outlook Calendar */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Outlook Calendar
              </CardTitle>
              <CardDescription>
                Sync obligations and deadlines with your Outlook Calendar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertCircle className="w-5 h-5" />
                <span>Not connected</span>
              </div>
              <Button onClick={() => handleConnect("Outlook")}>
                <Link2 className="w-4 h-4 mr-2" />
                Connect Outlook Calendar
              </Button>
            </CardContent>
          </Card>
        </div>
        
        {/* Sync Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Sync Settings</CardTitle>
            <CardDescription>Configure how obligations sync with your calendar</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-sync enabled</p>
                  <p className="text-sm text-muted-foreground">
                    Automatically sync new obligations to your calendar
                  </p>
                </div>
                <Badge variant="outline">Coming Soon</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Reminder notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Receive calendar reminders for upcoming deadlines
                  </p>
                </div>
                <Badge variant="outline">Coming Soon</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
