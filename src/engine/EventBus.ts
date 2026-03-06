import mitt from 'mitt';
import type { EngineEvents } from './types';

export const engineBus = mitt<EngineEvents>();
