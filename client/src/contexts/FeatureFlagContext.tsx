import React, { createContext, useContext, ReactNode } from 'react';
import type { FeatureFlagKey } from '../../../shared/featureFlags';

// Default flags for client-side (will be hydrated from server)
const DEFAULT_FLAGS: Record<FeatureFlagKey, boolean> = {
  AUTH_LOCAL: true,
  AUTH_OAUTH: true,
  DOCUMENT_UPLOAD: true,
  AI_CATEGORIZATION: true,
  COMMENTS: true,
  WORKSPACE_CRUD: true,
  CHECKLIST_CRUD: true,
  ARTIFACT_HUB: true,
  OM_PORTAL: true,
  EMAIL_INGESTION: false,
  WHATSAPP_INGESTION: false,
  LINKING_ENGINE: false,
  EXPORT_CSV: true,
  EXPORT_DD_PACK: false,
  VATR_EDIT: false,
  ENTITY_RESOLUTION: false,
  TWO_FA_DISABLE: false,
};

interface FeatureFlagContextType {
  flags: Record<FeatureFlagKey, boolean>;
  isEnabled: (key: FeatureFlagKey) => boolean;
}

const FeatureFlagContext = createContext<FeatureFlagContextType>({
  flags: DEFAULT_FLAGS,
  isEnabled: (key) => DEFAULT_FLAGS[key] ?? false,
});

interface FeatureFlagProviderProps {
  children: ReactNode;
  flags?: Partial<Record<FeatureFlagKey, boolean>>;
}

export function FeatureFlagProvider({ children, flags }: FeatureFlagProviderProps) {
  const mergedFlags = { ...DEFAULT_FLAGS, ...flags };
  
  const isEnabled = (key: FeatureFlagKey): boolean => {
    return mergedFlags[key] ?? false;
  };

  return (
    <FeatureFlagContext.Provider value={{ flags: mergedFlags, isEnabled }}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlags() {
  return useContext(FeatureFlagContext);
}

export function useFeatureFlag(key: FeatureFlagKey): boolean {
  const { isEnabled } = useContext(FeatureFlagContext);
  return isEnabled(key);
}
