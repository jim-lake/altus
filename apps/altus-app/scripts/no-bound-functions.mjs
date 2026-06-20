// eslint-rules/no-bound-functions.js

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require named functions to use function declarations instead of variable bindings',
    },
    schema: [],
    messages: {
      useDeclaration:
        'Use a function declaration instead of assigning a function to a variable.',
    },
  },

  create(context) {
    return {
      VariableDeclarator(node) {
        const init = node.init;

        if (
          init &&
          (init.type === 'ArrowFunctionExpression' ||
            init.type === 'FunctionExpression')
        ) {
          context.report({ node, messageId: 'useDeclaration' });
        }
      },
    };
  },
};
