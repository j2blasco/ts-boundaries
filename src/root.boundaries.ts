import type { Boundaries } from './core/boundaries.types';

const boundaries: Boundaries = {
  name: 'root',
  internal: [],
  external: ['fs', 'path', 'url', 'util', 'child_process', '@types/*'],
};

export default boundaries;
