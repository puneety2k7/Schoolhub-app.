import { OPERATION_STATES, type ActionState, type StandardOperation } from '@shared/index';
import type { RuntimeTab } from '../types';

/**
 * The universal standard-action selection. Inputs are explicit data only: the tab's permitted+enabled actions (from the
 * backend runtime definition) and the record's explicit lifecycle state ('None' = tab toolbar).
 */
export function selectActions(tab: Pick<RuntimeTab, 'actions'>, state: ActionState): { operation: StandardOperation; label: string }[] {
  return tab.actions.filter((action) => OPERATION_STATES[action.operation].includes(state));
}
