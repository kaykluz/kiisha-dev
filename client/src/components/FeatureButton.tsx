import React, { ReactNode, ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useFeatureFlag } from '@/contexts/FeatureFlagContext';
import type { FeatureFlagKey } from '../../../shared/featureFlags';

type ButtonProps = ComponentProps<typeof Button>;

interface FeatureButtonProps extends ButtonProps {
  featureFlag: FeatureFlagKey;
  children: ReactNode;
  disabledTooltip?: string;
}

/**
 * A button that is automatically disabled when its feature flag is off.
 * Shows a tooltip explaining the feature is coming soon.
 */
export function FeatureButton({
  featureFlag,
  children,
  disabledTooltip = 'This feature is coming soon',
  disabled,
  className,
  ...props
}: FeatureButtonProps) {
  const isEnabled = useFeatureFlag(featureFlag);
  const isDisabled = disabled || !isEnabled;

  if (!isEnabled) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block">
              <Button
                {...props}
                disabled
                className={`opacity-50 cursor-not-allowed ${className || ''}`}
              >
                {children}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{disabledTooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Button {...props} disabled={disabled} className={className}>
      {children}
    </Button>
  );
}

interface FeatureGateProps {
  featureFlag: FeatureFlagKey;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Conditionally renders children based on feature flag.
 * Use this to hide entire sections when a feature is disabled.
 */
export function FeatureGate({ featureFlag, children, fallback = null }: FeatureGateProps) {
  const isEnabled = useFeatureFlag(featureFlag);
  
  if (!isEnabled) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

interface DisabledFeaturePlaceholderProps {
  featureName: string;
  description?: string;
}

/**
 * A placeholder component shown when a feature is disabled.
 * Use this instead of hiding content entirely when you want users to know
 * the feature exists but isn't available yet.
 */
export function DisabledFeaturePlaceholder({
  featureName,
  description = 'This feature will be available soon.',
}: DisabledFeaturePlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-border rounded-lg bg-muted/30">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <svg
          className="w-6 h-6 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-foreground mb-1">{featureName}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
    </div>
  );
}
