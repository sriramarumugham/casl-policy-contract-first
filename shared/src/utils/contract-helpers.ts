// 🎯 Contract Policy Helpers - Clean integration of CASL with ts-rest contracts
import { AppAction, AppSubject, AppRawRule } from '../types/casl-types';

// Policy configuration for contract routes - now with full CASL RawRule power!
interface PolicyConfig {
  actions: AppAction; // Simplify for now - single action per rule
  subjects: AppSubject; // Simplify for now - single subject per rule  
  conditions?: Record<string, any>;
  fields?: string[]; // 🔥 Field-level permissions
  inverted?: boolean; // 🔥 Negative rules (forbid)
  reason?: string; // 🔥 Custom denial messages
  description?: string;
}

// Contract route definition (simplified type for ts-rest)
interface ContractRoute {
  method: string;
  path: string;
  summary?: string;
  description?: string;
  body?: any;
  pathParams?: any;
  query?: any;
  responses: any;
}

// Enhanced contract route with full RawRule policy metadata
interface PolicyRoute extends ContractRoute {
  __policy: AppRawRule;
  [key: string]: any; // Index signature for ts-rest compatibility
}

/**
 * 🔒 withPolicy - Elegant CASL policy wrapper for ts-rest contracts
 * 
 * @example
 * createPost: withPolicy({
 *   subjects: ["Post"],
 *   actions: ["create"], 
 *   description: "Create a new post"
 * })({
 *   method: "POST",
 *   path: "/posts",
 *   body: z.object({ title: z.string() }),
 *   responses: { 201: z.object({ success: z.boolean() }) }
 * })
 */
export function withPolicy(config: PolicyConfig) {
  return function(route: ContractRoute): PolicyRoute {
    const action = config.actions;
    const subject = config.subjects;
    
    // Create description with full CASL features
    let policyDescription = config.description || `${config.inverted ? 'Forbid' : 'Allow'} ${action} on ${subject}`;
    
    if (!config.inverted) {
      policyDescription += `. Requires '${action}' permission on '${subject}' subject`;
      if (config.fields?.length) {
        policyDescription += ` (fields: ${config.fields.join(', ')})`;
      }
      if (config.conditions) {
        policyDescription += ` with conditions`;
      }
    } else {
      policyDescription += `. Explicitly forbids '${action}' on '${subject}'`;
      if (config.reason) {
        policyDescription += `. Reason: ${config.reason}`;
      }
    }
    
    // Create enhanced route with full RawRule policy metadata
    const enhancedRoute: PolicyRoute = {
      ...route,
      description: route.description || policyDescription,
      summary: route.summary || config.description || `${config.inverted ? 'Forbid' : 'Allow'} ${action} ${subject}`,
      __policy: {
        action: config.actions,
        subject: config.subjects,
        ...(config.conditions && { conditions: config.conditions }),
        ...(config.fields && { fields: config.fields }),
        ...(config.inverted && { inverted: config.inverted }),
        ...(config.reason && { reason: config.reason })
      } as AppRawRule
    };
    
    return enhancedRoute;
  };
}