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
      Identifier(node) {
        if (!banned.has(node.name)) return;
        // allow when used as MemberExpression property (p.fill)
        const parent = node.parent;
        if (
          parent &&
          parent.type === 'MemberExpression' &&
          parent.property === node
        )
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
