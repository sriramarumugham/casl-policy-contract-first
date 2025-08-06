export interface PolicyRule {
  action: string;
  subject: string;
  conditions?: Record<string, any>;
}

export interface AppPolicy {
  [subject: string]: {
    actions: string[];
    permissions: PolicyRule[];
  };
}

export function extractAppPolicy(contract: any): AppPolicy {
  const appPolicy: AppPolicy = {};

  function traverse(obj: any) {
    for (const [, value] of Object.entries(obj)) {
      if (typeof value === "object" && value !== null) {
        if ("__policy" in value) {
          const policy = (value as any).__policy;

          for (const subject of policy.subjects) {
            if (!appPolicy[subject]) {
              appPolicy[subject] = {
                actions: [],
                permissions: [],
              };
            }

            for (const action of policy.actions) {
              if (!appPolicy[subject].actions.includes(action)) {
                appPolicy[subject].actions.push(action);
              }
            }

            for (const action of policy.actions) {
              appPolicy[subject].permissions.push({
                action,
                subject,
                conditions: policy.conditions,
              });
            }
          }
        } else {
          traverse(value);
        }
      }
    }
  }

  traverse(contract);
  return appPolicy;
}

export function createDefaultUserPolicy(appPolicy: AppPolicy): PolicyRule[] {
  const rules: PolicyRule[] = [];

  for (const [, config] of Object.entries(appPolicy)) {
    for (const permission of config.permissions) {
      rules.push({
        action: permission.action,
        subject: permission.subject,
        conditions: permission.conditions,
      });
    }
  }

  return rules;
}

export function interpolatePolicy(
  policy: PolicyRule[],
  context: { userId: number }
): PolicyRule[] {
  return policy.map((rule) => ({
    ...rule,
    conditions: interpolateConditions(rule.conditions, context),
  }));
}

function interpolateConditions(
  conditions: any,
  context: Record<string, any>
): any {
  if (!conditions) return conditions;

  const result = { ...conditions };
  for (const [key, value] of Object.entries(result)) {
    if (
      typeof value === "string" &&
      value.startsWith("{{") &&
      value.endsWith("}}")
    ) {
      const contextKey = value.slice(2, -2);
      result[key] = context[contextKey];
    }
  }
  return result;
}