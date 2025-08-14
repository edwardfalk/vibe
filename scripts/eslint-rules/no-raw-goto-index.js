/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'In tests, forbid raw page.goto(INDEX_PAGE); require gotoIndex(page) helper',
    },
    schema: [],
    messages: {
      noRawGoto: 'Use gotoIndex(page) instead of page.goto(INDEX_PAGE).',
    },
  },
  create(ctx) {
    const filename = String(ctx.getFilename && ctx.getFilename());
    const isSetup = /tests[\\\/]playwright\.setup\.js$/i.test(filename);
    if (isSetup) {
      // Allow raw goto in the helper definition file
      return {};
    }
    return {
      CallExpression(node) {
        try {
          const callee = node.callee;
          if (callee.type !== 'MemberExpression') return;
          const obj = callee.object;
          const prop = callee.property;
          if (obj?.name !== 'page' || prop?.name !== 'goto') return;
          const firstArg = node.arguments?.[0];
          if (!firstArg) return;
          if (
            firstArg.type === 'Identifier' &&
            firstArg.name === 'INDEX_PAGE'
          ) {
            ctx.report({ node, messageId: 'noRawGoto' });
          }
          if (
            firstArg.type === 'Literal' &&
            String(firstArg.value || '') === '/index.html'
          ) {
            ctx.report({ node, messageId: 'noRawGoto' });
          }
        } catch {}
      },
    };
  },
};
