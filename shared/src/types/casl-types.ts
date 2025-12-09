// 🎯 CASL Type Definitions - Define FIRST for full type safety
// These types are used everywhere: contracts, generation, frontend, backend

import { MongoAbility, CreateAbility, createMongoAbility, AbilityBuilder } from '@casl/ability';

// Define all possible actions in the app
export type AppAction = 'create' | 'read' | 'update' | 'delete';

// Define all possible subjects in the app  
export type AppSubject = 'Post' | 'User' | 'Comment';

// Note: SUBJECTS and ACTIONS arrays are exported from generated/app-rules.ts
// They contain only the subjects/actions that actually exist in contracts

// Define interfaces for better type safety
export interface Post {
  id: number;
  title: string;
  content: string;
  authorId: number;
}

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface Comment {
  id: number;
  content: string;
  authorId: number;
  postId: number;
}

// 🔥 Define our own rule interface compatible with CASL RawRule features
export interface AppRawRule {
  action: AppAction;
  subject: AppSubject;
  conditions?: Record<string, any>;
  fields?: string[];
  inverted?: boolean; 
  reason?: string;
}

// Backward compatibility
export type PolicyRule = AppRawRule;

// Define strict ability tuples for type safety
type Abilities = [AppAction, AppSubject | 'all'];

// Create type-safe AppAbility using companion pattern
export type AppAbility = MongoAbility<Abilities>;
export const createTypedAppAbility = createMongoAbility as CreateAbility<AppAbility>;

// Simple condition interpolation
function interpolateConditions(conditions: any, context: { userId: number }): any {
  if (!conditions) return conditions;
  
  const result = { ...conditions };
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
      const contextKey = value.slice(2, -2);
      result[key] = context[contextKey as keyof typeof context];
    }
  }
  return result;
}

// Create ability with user context and interpolation - now with full RawRule support!
export function createAppAbility(userRules: AppRawRule[], context: { userId: number }): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createTypedAppAbility);
  
  for (const rule of userRules) {
    const conditions = rule.conditions ? interpolateConditions(rule.conditions, context) : undefined;
    
    // 🔥 Full CASL RawRule support!
    if (rule.inverted) {
      // Handle negative rules (forbid something)
      cannot(rule.action as any, rule.subject as any, conditions);
    } else {
      // Handle positive rules (allow something)
      can(rule.action as any, rule.subject as any, rule.fields, conditions);
    }
  }
  
  return build();
}

// Export factory for frontend - pure JSON rules approach  
export function createTypedAbilityFromJSON(userRules: any[]): AppAbility {
  return createTypedAppAbility(userRules as any);
}