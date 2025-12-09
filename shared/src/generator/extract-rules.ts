#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { appContract } from '../contracts/posts';
import { PolicyRule } from '../types/casl-types';

// Extract ability rules directly from contracts
function extractAbilityRules(contract: any): PolicyRule[] {
  const rules: PolicyRule[] = [];
  
  function traverse(obj: any) {
    for (const [, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        if ('__policy' in value) {
          const policy = (value as any).__policy;
          rules.push({
            action: policy.action,
            subject: policy.subject,
            conditions: policy.conditions,
          });
        } else {
          traverse(value);
        }
      }
    }
  }
  
  traverse(contract);
  return rules;
}

function generateAppRulesJSON() {
  // Extract all ability rules from contracts
  const allRules = extractAbilityRules(appContract);
  
  // Get unique subjects and actions from extracted rules
  const subjects = [...new Set(allRules.map(r => r.subject))];
  const actions = [...new Set(allRules.map(r => r.action))];
  
  // Create JSON with rules only
  const rulesJSON = {
    subjects,
    actions, 
    rules: allRules
  };
  
  // Write JSON file
  const jsonPath = path.join(__dirname, '../generated/app-rules.json');
  const dir = path.dirname(jsonPath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(jsonPath, JSON.stringify(rulesJSON, null, 2));
  
  console.log('✅ Generated app rules JSON at:', jsonPath);
  console.log('📋 Found', allRules.length, 'rules from contracts');
}

if (require.main === module) {
  generateAppRulesJSON();
}

export { generateAppRulesJSON };