/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Forbid unprefixed p5 globals in instance mode; require p.<fn> or imports from mathUtils',
    },
    schema: [],
    messages: {
      noP5Global:
        'Instance mode: do not use global p5 function "{{name}}"; use p.{{name}} or import from mathUtils.js.',
    },
  },
  create(ctx) {
    // Track locally imported math/p5-like helpers so we don't flag them
    /** @type {Set<string>} */
    const importedNames = new Set();
    const allowedSources = new Set(['@vibe/core', '@vibe/core/mathUtils.js']);

    const banned = new Set([
      'fill',
      'stroke',
      'ellipse',
      'rect',
      'line',
      'text',
      'sin',
      'cos',
      'atan2',
      'sqrt',
      'random',
      'dist',
      'push',
      'pop',
      'translate',
      'rotate',
      'scale',
      'noFill',
      'noStroke',
    ]);
    return {
      // Collect local imports to avoid false positives
      Program(node) {
        try {
          for (const stmt of node.body) {
            if (
              stmt.type === 'ImportDeclaration' &&
              stmt.source &&
              allowedSources.has(stmt.source.value)
            ) {
              for (const spec of stmt.specifiers) {
                if (
                  spec.type === 'ImportSpecifier' ||
                  spec.type === 'ImportDefaultSpecifier' ||
                  spec.type === 'ImportNamespaceSpecifier'
                ) {
                  if (spec.local && spec.local.name)
                    importedNames.add(spec.local.name);
                }
              }
            }
          }
        } catch {}
      },
      Identifier(node) {
        if (!banned.has(node.name)) return;
        if (importedNames.has(node.name)) return; // allow locally imported helpers
        const parent = node.parent;
        // Allow property names and variable declarations
        if (parent?.type === 'MemberExpression' && parent.property === node)
          return; // p.fill
        if (parent?.type === 'VariableDeclarator' && parent.id === node) return;
        if (parent?.type === 'Property' && parent.key === node) return;
        if (parent?.type === 'ImportSpecifier') return;
        // Only flag when actually calling as a function: sin(...)
        if (!(parent?.type === 'CallExpression' && parent.callee === node))
          return;
        ctx.report({
          node,
          messageId: 'noP5Global',
          data: { name: node.name },
        });
      },
    };
  },
};
