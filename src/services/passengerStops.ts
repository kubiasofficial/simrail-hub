import type {TimetablePoint} from '../types/trains';

/** PH: only an explicitly scheduled commercial stop accepts passengers. */
export function isPassengerStop(point: Pick<TimetablePoint,'stopType'>): boolean {
  return /^(?:CommercialStop|PH)$/i.test(point.stopType?.trim() ?? '');
}
