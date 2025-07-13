# @j2blasco/ts-boundaries

A tool to generate ESLint boundaries configuration from TypeScript boundary definitions. This package helps you enforce architectural boundaries in your TypeScript projects by automatically generating ESLint rules based on `.boundaries.ts` files.

## Installation

```bash
npm install --save-dev @j2blasco/ts-boundaries eslint-plugin-boundaries tsx
```

## Usage

### 1. Define Boundaries

Create `.boundaries.ts` files in your source directory to define architectural boundaries:

```typescript
// src/domain/domain.boundaries.ts
export default {
  name: 'domain',
  internal: ['domain'], // Can import from other domain modules
  external: ['@types/*'] // Can only import these external packages
};

// src/infrastructure/infrastructure.boundaries.ts  
export default {
  name: 'infrastructure',
  internal: ['infrastructure'], // Can import from other infrastructure modules
  external: ['axios', 'fs', 'path'] // Can import these external packages
};

// src/root.boundaries.ts
export default {
  name: 'root',
  internal: ['domain', 'infrastructure'], // Root can import from domain and infrastructure
  external: ['@types/*']
};
```

### 2. Generate ESLint Configuration

Add a script to your `package.json`:

```json
{
  "scripts": {
    "boundaries:generate": "ts-boundaries"
  }
}
```

Then run:

```bash
npm run boundaries:generate
```

This will generate `eslint.boundaries.generated.mjs` in your project root.

> **Note**: The tool automatically uses `tsx` to handle TypeScript `.boundaries.ts` files. Make sure `tsx` is installed as a dev dependency.

### 3. Include in ESLint Configuration

Import the generated configuration in your `eslint.config.mjs`:

```javascript
import boundariesConfig from './eslint.boundaries.generated.mjs';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...boundariesConfig, // Include the generated boundaries configuration
  {
    // Your other ESLint rules...
  }
];
```

## Boundary File Format

Each `.boundaries.ts` file should export a default object with the following structure:

```typescript
export default {
  name: string;        // Unique name for this boundary
  internal: string[];  // Array of boundary types this boundary can import from
  external: string[];  // Array of external packages this boundary can import
};
```

## Example Project Structure

```
src/
├── domain/
│   ├── user/
│   │   ├── user.entity.ts
│   │   └── user.repository.ts
│   └── domain.boundaries.ts
├── infrastructure/
│   ├── database/
│   │   └── user.repository.impl.ts
│   └── infrastructure.boundaries.ts
├── application/
│   ├── services/
│   │   └── user.service.ts
│   └── application.boundaries.ts
└── root.boundaries.ts
```

This will enforce that:
- Domain layer can only import from domain and specified external packages
- Infrastructure can only import from infrastructure and its allowed externals
- Application layer follows its defined boundaries
- Root level can coordinate between all layers

## How Other Projects Use It

Once you publish this package, other projects can use it like this:

1. **Install the package:**
   ```bash
   npm install --save-dev @j2blasco/ts-boundaries eslint-plugin-boundaries tsx
   ```

2. **Add the script to their package.json:**
   ```json
   {
     "scripts": {
       "boundaries:generate": "ts-boundaries"
     }
   }
   ```

3. **Create their boundary files** in `src/` directory

4. **Run the generator:**
   ```bash
   npm run boundaries:generate
   ```

5. **Include in their ESLint config:**
   ```javascript
   import boundariesConfig from './eslint.boundaries.generated.mjs';
   // ... rest of their ESLint config
   ```

## License

MIT
