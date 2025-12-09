// 📋 App Rules - Generated from contracts (JSON only, types are separate)
import { PolicyRule } from '../types/casl-types';
import rulesData from './app-rules.json';

// Export the generated rules with proper typing
export const APP_ABILITY_RULES: readonly PolicyRule[] = rulesData.rules as PolicyRule[];

// Export for backwards compatibility
export const SUBJECTS: string[] = rulesData.subjects;
export const ACTIONS: string[] = rulesData.actions;