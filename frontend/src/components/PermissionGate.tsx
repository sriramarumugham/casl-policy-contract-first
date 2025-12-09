// 🔒 Permission Gate - Show/hide content based on CASL permissions
import { AppAbility, AppAction, AppSubject } from "@casl-poc/shared";

interface PermissionGateProps {
  ability: AppAbility;
  action: AppAction;
  subject: AppSubject;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGate({ 
  ability, 
  action, 
  subject, 
  fallback = null, 
  children 
}: PermissionGateProps) {
  // Pure CASL power - one line permission check!
  if (!ability.can(action, subject)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}