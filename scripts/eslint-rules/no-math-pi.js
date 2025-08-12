/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Forbid Math.PI and raw 2*Math.PI in packages/**; use PI/TWO_PI from @vibe/core/mathUtils.js' },
    schema: [],
    messages: {
      noMathPi: 'Use PI/TWO_PI from @vibe/core instead of Math.PI or raw 2*Math.PI.'
    }
  },
  create(ctx) {
    return {
      MemberExpression(node) {
        if (node.object?.name === 'Math' && node.property?.name === 'PI') {
          ctx.report({ node, messageId: 'noMathPi' });
        }
      },
      BinaryExpression(node) {
        const isTwoTimesMathPi =
          node.operator === '*'
          && ((node.left.type === 'Literal' && node.left.value === 2 && node.right.type === 'MemberExpression' && node.right.object?.name === 'Math' && node.right.property?.name === 'PI')
              || (node.right.type === 'Literal' && node.right.value === 2 && node.left.type === 'MemberExpression' && node.left.object?.name === 'Math' && node.left.property?.name === 'PI'));
        if (isTwoTimesMathPi) {
          ctx.report({ node, messageId: 'noMathPi' });
        }
      }
    };
  }
};