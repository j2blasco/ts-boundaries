import type { Boundaries } from './boundaries.types';

const boundaries: Boundaries = {
  name: 'root',
  internal: [],
  external: ['fs', 'path', 'url', 'child_process', '@types/*'],
};

export default boundaries;
