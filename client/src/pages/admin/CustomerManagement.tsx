import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Plus, Search, Mail, Building2, Users, FileText, CreditCard, Send, Eye, Trash2, Edit, Clock, CheckCircle, XCircle, UserPlus } from "lucide-react";

export default function CustomerManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isPreRegisterOpen, setIsPreRegisterOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [selectedPendingUser, setSelectedPendingUser] = useState<any>(null);
  const [approveCustomerId, setApproveCustomerId] = useState<string>("");
  const [approveRole, setApproveRole] = useState<"admin" | "viewer">("viewer");
  const [preRegisterEmail, setPreRegisterEmail] = useState("");
  const [preRegisterRole, setPreRegisterRole] = useState<"admin" | "viewer">("viewer");
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    address: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
    notes: "",
  });
  const [inviteEmail, setInviteEmail] = useState("");

  const { data: customers, isLoading, refetch } = trpc.customerPortal.listCustomers.useQuery({
    orgId: 1, // TODO: Get from user context
    search: searchQuery || undefined,
    limit: 50,
  });

  const { data: pendingUsers, refetch: refetchPending } = trpc.customerPortal.listPendingCustomerUsers.useQuery({
    orgId: 1, // TODO: Get from user context
    limit: 50,
  });

  const createCustomerMutation = trpc.customerPortal.createCustomer.useMutation({
    onSuccess: () => {
      toast.success("Customer created successfully");
      setIsCreateOpen(false);
      setNewCustomer({
        name: "",
        email: "",
        phone: "",
        company: "",
        address: "",
        city: "",
        state: "",
        country: "",
        postalCode: "",
        notes: "",
      });
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create customer");
    },
  });

  const inviteCustomerMutation = trpc.customerPortal.inviteCustomerUser.useMutation({
    onSuccess: () => {
      toast.success("Invitation sent successfully");
      setIsInviteOpen(false);
      setInviteEmail("");
      setSelectedCustomer(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send invitation");
    },
  });

  const approveUserMutation = trpc.customerPortal.approveCustomerUser.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setIsApproveOpen(false);
      setSelectedPendingUser(null);
      setApproveCustomerId("");
      setApproveRole("viewer");
      refetchPending();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to approve user");
    },
  });

  const rejectUserMutation = trpc.customerPortal.rejectCustomerUser.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchPending();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to reject user");
    },
  });

  const preRegisterMutation = trpc.customerPortal.preRegisterCustomerEmail.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setIsPreRegisterOpen(false);
      setPreRegisterEmail("");
      setPreRegisterRole("viewer");
      setSelectedCustomer(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to pre-register email");
    },
  });

  const handleCreateCustomer = () => {
    if (!newCustomer.name || !newCustomer.email) {
      toast.error("Name and email are required");
      return;
    }
    createCustomerMutation.mutate({
      orgId: 1, // TODO: Get from user context
      code: newCustomer.company?.replace(/\s+/g, '-').toUpperCase() || `CUST-${Date.now()}`,
      name: newCustomer.name,
      companyName: newCustomer.company,
      email: newCustomer.email,
      phone: newCustomer.phone,
      address: newCustomer.address,
      city: newCustomer.city,
      state: newCustomer.state,
      country: newCustomer.country,
      postalCode: newCustomer.postalCode,
      notes: newCustomer.notes,
    });
  };

  const handleInviteUser = () => {
    if (!inviteEmail || !selectedCustomer) {
      toast.error("Email is required");
      return;
    }
    inviteCustomerMutation.mutate({
      customerId: selectedCustomer.id,
      email: inviteEmail,
      role: "viewer",
    });
  };

  const handleApproveUser = () => {
    if (!selectedPendingUser || !approveCustomerId) {
      toast.error("Please select a customer");
      return;
    }
    approveUserMutation.mutate({
      userId: selectedPendingUser.id,
      customerId: parseInt(approveCustomerId),
      role: approveRole,
    });
  };

  const handleRejectUser = (user: any) => {
    if (confirm(`Are you sure you want to reject and remove ${user.email}?`)) {
      rejectUserMutation.mutate({ userId: user.id });
    }
  };

  const handlePreRegister = () => {
    if (!preRegisterEmail || !selectedCustomer) {
      toast.error("Email and customer are required");
      return;
    }
    preRegisterMutation.mutate({
      customerId: selectedCustomer.id,
      email: preRegisterEmail,
      role: preRegisterRole,
    });
  };

  const filteredCustomers = customers?.customers || [];
  const pendingUsersList = pendingUsers?.users || [];
  const pendingCount = pendingUsers?.total || 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Customer Management</h1>
            <p className="text-muted-foreground">
              Manage customer accounts and portal access
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Customer</DialogTitle>
                <DialogDescription>
                  Add a new customer to the system. They can be invited to the portal later.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Contact Name *</Label>
                    <Input
                      id="name"
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                      placeholder="John Smith"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newCustomer.email}
                      onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                      placeholder="john@company.com"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company">Company Name</Label>
                    <Input
                      id="company"
                      value={newCustomer.company}
                      onChange={(e) => setNewCustomer({ ...newCustomer, company: e.target.value })}
                      placeholder="Acme Solar Ltd"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                      placeholder="+1 234 567 8900"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                    placeholder="123 Solar Street"
                  />
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={newCustomer.city}
                      onChange={(e) => setNewCustomer({ ...newCustomer, city: e.target.value })}
                      placeholder="Lagos"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={newCustomer.state}
                      onChange={(e) => setNewCustomer({ ...newCustomer, state: e.target.value })}
                      placeholder="Lagos"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={newCustomer.country}
                      onChange={(e) => setNewCustomer({ ...newCustomer, country: e.target.value })}
                      placeholder="Nigeria"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postalCode">Postal Code</Label>
                    <Input
                      id="postalCode"
                      value={newCustomer.postalCode}
                      onChange={(e) => setNewCustomer({ ...newCustomer, postalCode: e.target.value })}
                      placeholder="100001"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={newCustomer.notes}
                    onChange={(e) => setNewCustomer({ ...newCustomer, notes: e.target.value })}
                    placeholder="Additional notes about this customer..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateCustomer} disabled={createCustomerMutation.isPending}>
                  {createCustomerMutation.isPending ? "Creating..." : "Create Customer"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{customers?.total || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Portal Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {filteredCustomers.filter((c: any) => c.portalEnabled).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{pendingCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Customers and Pending Approvals */}
        <Tabs defaultValue="customers" className="space-y-4">
          <TabsList>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="pending" className="relative">
              Pending Approvals
              {pendingCount > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Customers Tab */}
          <TabsContent value="customers">
            <Card>
              <CardHeader>
                <CardTitle>Customers</CardTitle>
                <CardDescription>
                  View and manage all customer accounts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search customers by name, email, or company..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading customers...</div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No customers found. Create your first customer to get started.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Portal Access</TableHead>
                        <TableHead>Projects</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCustomers.map((customer: any) => (
                        <TableRow key={customer.id}>
                          <TableCell>
                            <div className="font-medium">{customer.name}</div>
                            <div className="text-sm text-muted-foreground">{customer.email}</div>
                          </TableCell>
                          <TableCell>{customer.company || "-"}</TableCell>
                          <TableCell>{customer.phone || "-"}</TableCell>
                          <TableCell>
                            {customer.portalEnabled ? (
                              <Badge variant="default" className="bg-green-500">Active</Badge>
                            ) : (
                              <Badge variant="secondary">Not Invited</Badge>
                            )}
                          </TableCell>
                          <TableCell>{customer.projectCount || 0}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Invite to Portal"
                                onClick={() => {
                                  setSelectedCustomer(customer);
                                  setIsInviteOpen(true);
                                }}
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Pre-register Email"
                                onClick={() => {
                                  setSelectedCustomer(customer);
                                  setIsPreRegisterOpen(true);
                                }}
                              >
                                <UserPlus className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" title="View Details">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" title="Edit">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pending Approvals Tab */}
          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle>Pending Access Requests</CardTitle>
                <CardDescription>
                  Users who have registered for portal access and are awaiting approval
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pendingUsersList.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No pending access requests
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email Verified</TableHead>
                        <TableHead>Registered</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingUsersList.map((user: any) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </TableCell>
                          <TableCell>
                            {user.emailVerified ? (
                              <Badge variant="default" className="bg-green-500">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Verified
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <Clock className="h-3 w-3 mr-1" />
                                Pending
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="default"
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => {
                                  setSelectedPendingUser(user);
                                  setIsApproveOpen(true);
                                }}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleRejectUser(user)}
                                disabled={rejectUserMutation.isPending}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Invite User Dialog */}
        <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite to Portal</DialogTitle>
              <DialogDescription>
                Send a portal invitation to {selectedCustomer?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="inviteEmail">Email Address</Label>
                <Input
                  id="inviteEmail"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@company.com"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                An email will be sent with instructions to access the customer portal.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsInviteOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleInviteUser} disabled={inviteCustomerMutation.isPending}>
                <Mail className="mr-2 h-4 w-4" />
                {inviteCustomerMutation.isPending ? "Sending..." : "Send Invitation"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Approve User Dialog */}
        <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approve Access Request</DialogTitle>
              <DialogDescription>
                Assign {selectedPendingUser?.email} to a customer account
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Select Customer</Label>
                <Select value={approveCustomerId} onValueChange={setApproveCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a customer account" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCustomers.map((customer: any) => (
                      <SelectItem key={customer.id} value={customer.id.toString()}>
                        {customer.name} {customer.company ? `(${customer.company})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={approveRole} onValueChange={(v) => setApproveRole(v as "admin" | "viewer")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer - Can view data only</SelectItem>
                    <SelectItem value="admin">Admin - Can manage customer account</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsApproveOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleApproveUser} 
                disabled={approveUserMutation.isPending || !approveCustomerId}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                {approveUserMutation.isPending ? "Approving..." : "Approve Access"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Pre-register Email Dialog */}
        <Dialog open={isPreRegisterOpen} onOpenChange={setIsPreRegisterOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Pre-register Email</DialogTitle>
              <DialogDescription>
                Pre-register an email for automatic access to {selectedCustomer?.name}. 
                When this user signs up, they will automatically be granted access.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="preRegisterEmail">Email Address</Label>
                <Input
                  id="preRegisterEmail"
                  type="email"
                  value={preRegisterEmail}
                  onChange={(e) => setPreRegisterEmail(e.target.value)}
                  placeholder="user@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={preRegisterRole} onValueChange={(v) => setPreRegisterRole(v as "admin" | "viewer")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer - Can view data only</SelectItem>
                    <SelectItem value="admin">Admin - Can manage customer account</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">
                This email will be whitelisted. When the user signs up with this email, 
                they will automatically be assigned to this customer account.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPreRegisterOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handlePreRegister} disabled={preRegisterMutation.isPending}>
                <UserPlus className="mr-2 h-4 w-4" />
                {preRegisterMutation.isPending ? "Registering..." : "Pre-register Email"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
