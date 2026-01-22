import { useState, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  MessageSquare, 
  Send, 
  MoreHorizontal, 
  Edit2, 
  Trash2, 
  Reply,
  Lock,
  AtSign,
  X,
  CheckCircle2,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Filter
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

type ResourceType = 'document' | 'workspace_item' | 'checklist_item' | 'project';

interface Comment {
  id: number;
  resourceType: string;
  resourceId: number;
  userId: number;
  content: string;
  parentId: number | null;
  isInternal: boolean;
  isEdited: boolean;
  isResolved: boolean;
  resolvedAt: Date | null;
  resolvedById: number | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CommentsSectionProps {
  resourceType: ResourceType;
  resourceId: number;
  className?: string;
}

// Mock user data - in production, this would come from the API
const mockUsers: Record<number, { name: string; email: string }> = {
  1: { name: 'Solomon Ojoawo', email: 'solomon@cloudbreak.com' },
  2: { name: 'Sarah Chen', email: 'sarah@cloudbreak.com' },
  3: { name: 'Michael Torres', email: 'michael@cloudbreak.com' },
  4: { name: 'Emily Johnson', email: 'emily@cloudbreak.com' },
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function CommentThread({ 
  comment, 
  currentUserId, 
  isAdmin,
  onReply,
  onEdit,
  onDelete,
  onResolve,
  onUnresolve,
  replies = [],
}: { 
  comment: Comment;
  currentUserId: number;
  isAdmin: boolean;
  onReply: (commentId: number) => void;
  onEdit: (comment: Comment) => void;
  onDelete: (commentId: number) => void;
  onResolve: (commentId: number) => void;
  onUnresolve: (commentId: number) => void;
  replies?: Comment[];
}) {
  const [isExpanded, setIsExpanded] = useState(!comment.isResolved);
  const user = mockUsers[comment.userId] || { name: 'Unknown User', email: '' };
  const resolvedByUser = comment.resolvedById ? mockUsers[comment.resolvedById] : null;
  const canModify = comment.userId === currentUserId || isAdmin;
  const isTopLevel = comment.parentId === null;

  return (
    <div className={cn(
      "rounded-lg transition-colors",
      comment.isResolved && "bg-success/5 border border-success/20"
    )}>
      {/* Thread header for resolved threads */}
      {isTopLevel && comment.isResolved && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-success hover:bg-success/10 transition-colors rounded-t-lg"
        >
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <CheckCircle2 className="h-4 w-4" />
          <span className="font-medium">Resolved</span>
          {resolvedByUser && (
            <span className="text-xs text-tertiary ml-1">
              by {resolvedByUser.name} {comment.resolvedAt && formatDistanceToNow(new Date(comment.resolvedAt), { addSuffix: true })}
            </span>
          )}
        </button>
      )}

      {/* Comment content - collapsible for resolved */}
      {(isExpanded || !comment.isResolved) && (
        <div className={cn("px-3", comment.isResolved && "pb-3")}>
          <CommentItem
            comment={comment}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onReply={onReply}
            onEdit={onEdit}
            onDelete={onDelete}
            onResolve={onResolve}
            onUnresolve={onUnresolve}
            depth={0}
            replies={replies}
            isTopLevel={isTopLevel}
          />
        </div>
      )}
    </div>
  );
}

function CommentItem({ 
  comment, 
  currentUserId, 
  isAdmin,
  onReply,
  onEdit,
  onDelete,
  onResolve,
  onUnresolve,
  depth = 0,
  replies = [],
  isTopLevel = false,
}: { 
  comment: Comment;
  currentUserId: number;
  isAdmin: boolean;
  onReply: (commentId: number) => void;
  onEdit: (comment: Comment) => void;
  onDelete: (commentId: number) => void;
  onResolve: (commentId: number) => void;
  onUnresolve: (commentId: number) => void;
  depth?: number;
  replies?: Comment[];
  isTopLevel?: boolean;
}) {
  const user = mockUsers[comment.userId] || { name: 'Unknown User', email: '' };
  const canModify = comment.userId === currentUserId || isAdmin;
  const maxDepth = 3;

  return (
    <div className={cn(depth > 0 && 'ml-8 border-l border-border-subtle pl-4')}>
      <div className="flex gap-3 py-3">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className="bg-surface-elevated text-xs">
            {getInitials(user.name)}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm text-primary">{user.name}</span>
            <span className="text-xs text-tertiary">
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
            </span>
            {comment.isEdited && (
              <span className="text-xs text-tertiary">(edited)</span>
            )}
            {comment.isInternal && (
              <span className="inline-flex items-center gap-1 text-xs text-warning bg-warning/10 px-1.5 py-0.5 rounded">
                <Lock className="h-3 w-3" />
                Internal
              </span>
            )}
          </div>
          
          <div className={cn(
            "text-sm whitespace-pre-wrap break-words",
            comment.isResolved ? "text-tertiary" : "text-secondary"
          )}>
            {comment.content}
          </div>
          
          <div className="flex items-center gap-2 mt-2">
            {depth < maxDepth && !comment.isResolved && (
              <button
                onClick={() => onReply(comment.id)}
                className="text-xs text-tertiary hover:text-primary flex items-center gap-1 transition-colors"
              >
                <Reply className="h-3 w-3" />
                Reply
              </button>
            )}
            
            {/* Resolve/Unresolve button for top-level comments */}
            {isTopLevel && depth === 0 && (
              comment.isResolved ? (
                <button
                  onClick={() => onUnresolve(comment.id)}
                  className="text-xs text-tertiary hover:text-primary flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reopen
                </button>
              ) : (
                <button
                  onClick={() => onResolve(comment.id)}
                  className="text-xs text-success hover:text-success/80 flex items-center gap-1 transition-colors"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Resolve
                </button>
              )
            )}
            
            {canModify && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="text-xs text-tertiary hover:text-primary transition-colors">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => onEdit(comment)}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onDelete(comment.id)}
                    className="text-error"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
      
      {/* Render replies */}
      {replies.length > 0 && (
        <div className="space-y-0">
          {replies.map(reply => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              onResolve={onResolve}
              onUnresolve={onUnresolve}
              depth={depth + 1}
              replies={[]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CommentsSection({ resourceType, resourceId, className = '' }: CommentsSectionProps) {
  const { user } = useAuth();
  const [newComment, setNewComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [editingComment, setEditingComment] = useState<Comment | null>(null);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [showResolved, setShowResolved] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const utils = trpc.useUtils();
  
  const { data: comments = [], isLoading } = trpc.comments.list.useQuery({
    resourceType,
    resourceId,
  });

  const { data: unresolvedCount = 0 } = trpc.comments.unresolvedCount.useQuery({
    resourceType,
    resourceId,
  });
  
  const createMutation = trpc.comments.create.useMutation({
    onSuccess: () => {
      setNewComment('');
      setReplyingTo(null);
      setIsInternal(false);
      utils.comments.list.invalidate({ resourceType, resourceId });
      utils.comments.count.invalidate({ resourceType, resourceId });
      utils.comments.unresolvedCount.invalidate({ resourceType, resourceId });
      toast.success('Comment added');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to add comment');
    },
  });
  
  const updateMutation = trpc.comments.update.useMutation({
    onSuccess: () => {
      setEditingComment(null);
      setNewComment('');
      utils.comments.list.invalidate({ resourceType, resourceId });
      toast.success('Comment updated');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update comment');
    },
  });
  
  const deleteMutation = trpc.comments.delete.useMutation({
    onSuccess: () => {
      utils.comments.list.invalidate({ resourceType, resourceId });
      utils.comments.count.invalidate({ resourceType, resourceId });
      utils.comments.unresolvedCount.invalidate({ resourceType, resourceId });
      toast.success('Comment deleted');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete comment');
    },
  });

  const resolveMutation = trpc.comments.resolve.useMutation({
    onSuccess: () => {
      utils.comments.list.invalidate({ resourceType, resourceId });
      utils.comments.unresolvedCount.invalidate({ resourceType, resourceId });
      toast.success('Thread marked as resolved');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to resolve thread');
    },
  });

  const unresolveMutation = trpc.comments.unresolve.useMutation({
    onSuccess: () => {
      utils.comments.list.invalidate({ resourceType, resourceId });
      utils.comments.unresolvedCount.invalidate({ resourceType, resourceId });
      toast.success('Thread reopened');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to reopen thread');
    },
  });

  // Parse mentions from content
  const parseMentions = (content: string): number[] => {
    const mentionRegex = /@\[([^\]]+)\]\((\d+)\)/g;
    const mentions: number[] = [];
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(parseInt(match[2], 10));
    }
    return mentions;
  };

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    
    if (editingComment) {
      updateMutation.mutate({
        id: editingComment.id,
        content: newComment.trim(),
      });
    } else {
      const mentions = parseMentions(newComment);
      createMutation.mutate({
        resourceType,
        resourceId,
        content: newComment.trim(),
        parentId: replyingTo ?? undefined,
        isInternal,
        mentions: mentions.length > 0 ? mentions : undefined,
      });
    }
  };

  const handleReply = (commentId: number) => {
    setReplyingTo(commentId);
    setEditingComment(null);
    textareaRef.current?.focus();
  };

  const handleEdit = (comment: Comment) => {
    setEditingComment(comment);
    setNewComment(comment.content);
    setReplyingTo(null);
    textareaRef.current?.focus();
  };

  const handleDelete = (commentId: number) => {
    if (confirm('Are you sure you want to delete this comment?')) {
      deleteMutation.mutate({ id: commentId });
    }
  };

  const handleResolve = (commentId: number) => {
    resolveMutation.mutate({ id: commentId });
  };

  const handleUnresolve = (commentId: number) => {
    unresolveMutation.mutate({ id: commentId });
  };

  const handleCancel = () => {
    setNewComment('');
    setReplyingTo(null);
    setEditingComment(null);
    setIsInternal(false);
  };

  const insertMention = (userId: number, name: string) => {
    const mention = `@[${name}](${userId}) `;
    setNewComment(prev => prev + mention);
    setShowMentionPicker(false);
    textareaRef.current?.focus();
  };

  // Organize comments into threads
  const rootComments = comments.filter(c => !c.parentId);
  const getReplies = (parentId: number) => comments.filter(c => c.parentId === parentId);

  // Filter based on resolved status
  const filteredRootComments = showResolved 
    ? rootComments 
    : rootComments.filter(c => !c.isResolved);

  const resolvedCount = rootComments.filter(c => c.isResolved).length;
  const totalThreads = rootComments.length;

  const currentUserId = user?.id || 0;
  const isAdmin = user?.role === 'admin';
  const canSeeInternal = user?.role === 'admin' || user?.role === 'user';

  // Loading skeleton
  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="h-8 w-8 rounded-full bg-surface-elevated" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-surface-elevated rounded" />
              <div className="h-12 w-full bg-surface-elevated rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Stats and filter bar */}
      {totalThreads > 0 && (
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            <span className="text-tertiary">
              {unresolvedCount} open {unresolvedCount === 1 ? 'thread' : 'threads'}
            </span>
            {resolvedCount > 0 && (
              <span className="text-success flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {resolvedCount} resolved
              </span>
            )}
          </div>
          
          {resolvedCount > 0 && (
            <button
              onClick={() => setShowResolved(!showResolved)}
              className={cn(
                "flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-colors",
                showResolved 
                  ? "text-tertiary hover:text-primary hover:bg-surface-elevated" 
                  : "text-brand bg-brand/10"
              )}
            >
              <Filter className="h-3 w-3" />
              {showResolved ? 'Hide resolved' : 'Show resolved'}
            </button>
          )}
        </div>
      )}

      {/* Comment input */}
      <div className="space-y-3">
        {(replyingTo || editingComment) && (
          <div className="flex items-center gap-2 text-sm text-secondary bg-surface-elevated px-3 py-2 rounded-lg">
            {editingComment ? (
              <>
                <Edit2 className="h-4 w-4" />
                <span>Editing comment</span>
              </>
            ) : (
              <>
                <Reply className="h-4 w-4" />
                <span>Replying to comment</span>
              </>
            )}
            <button onClick={handleCancel} className="ml-auto hover:text-primary">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment... Use @ to mention team members"
            className="min-h-[80px] pr-10 resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit();
              }
              if (e.key === '@') {
                setShowMentionPicker(true);
              }
            }}
          />
          
          <button
            onClick={() => setShowMentionPicker(!showMentionPicker)}
            className="absolute right-3 top-3 text-tertiary hover:text-primary transition-colors"
            title="Mention someone"
          >
            <AtSign className="h-4 w-4" />
          </button>
          
          {/* Mention picker */}
          {showMentionPicker && (
            <div className="absolute right-0 top-full mt-1 w-64 bg-surface border border-border-default rounded-lg shadow-lg z-10">
              <div className="p-2 border-b border-border-subtle">
                <span className="text-xs font-medium text-tertiary">Mention a team member</span>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {Object.entries(mockUsers).map(([id, u]) => (
                  <button
                    key={id}
                    onClick={() => insertMention(parseInt(id), u.name)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-elevated transition-colors text-left"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {getInitials(u.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-medium">{u.name}</div>
                      <div className="text-xs text-tertiary">{u.email}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {canSeeInternal && !editingComment && (
              <div className="flex items-center gap-2">
                <Switch
                  id="internal-comment"
                  checked={isInternal}
                  onCheckedChange={setIsInternal}
                  className="scale-75"
                />
                <Label htmlFor="internal-comment" className="text-xs text-tertiary cursor-pointer">
                  Internal only
                </Label>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {(replyingTo || editingComment) && (
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
            )}
            <Button 
              size="sm" 
              onClick={handleSubmit}
              disabled={!newComment.trim() || createMutation.isPending || updateMutation.isPending}
            >
              <Send className="h-4 w-4 mr-1" />
              {editingComment ? 'Update' : 'Send'}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Comments list */}
      <div className="border-t border-border-subtle pt-4">
        {filteredRootComments.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-10 w-10 mx-auto text-tertiary mb-2" />
            <p className="text-sm text-tertiary">
              {!showResolved && resolvedCount > 0 
                ? 'All threads are resolved' 
                : 'No comments yet'}
            </p>
            <p className="text-xs text-tertiary mt-1">
              {!showResolved && resolvedCount > 0 
                ? 'Click "Show resolved" to view them' 
                : 'Be the first to add a comment'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRootComments.map(comment => (
              <CommentThread
                key={comment.id}
                comment={comment}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                onReply={handleReply}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onResolve={handleResolve}
                onUnresolve={handleUnresolve}
                replies={getReplies(comment.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Export a compact version for showing in drawer tabs
export function CommentsCount({ 
  resourceType, 
  resourceId 
}: { 
  resourceType: ResourceType; 
  resourceId: number;
}) {
  const { data: count = 0 } = trpc.comments.count.useQuery({
    resourceType,
    resourceId,
  });
  
  if (count === 0) return null;
  
  return (
    <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-xs font-medium bg-brand/10 text-brand rounded-full">
      {count}
    </span>
  );
}

// Export unresolved count badge for showing open threads
export function UnresolvedCommentsCount({ 
  resourceType, 
  resourceId 
}: { 
  resourceType: ResourceType; 
  resourceId: number;
}) {
  const { data: count = 0 } = trpc.comments.unresolvedCount.useQuery({
    resourceType,
    resourceId,
  });
  
  if (count === 0) return null;
  
  return (
    <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-xs font-medium bg-warning/10 text-warning rounded-full">
      {count}
    </span>
  );
}
