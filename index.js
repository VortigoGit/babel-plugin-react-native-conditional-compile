'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});

function isCompilerAccessor(types, path) {
  const objectBeingAccessed = path.get('object');
  if (types.isIdentifier(objectBeingAccessed) && objectBeingAccessed.node.name === 'COMPILER') {
    return [objectBeingAccessed.node.name];
  } else if (types.isMemberExpression(objectBeingAccessed)) {
    const propertyBeingAccessed = objectBeingAccessed.get('property');

    return [...isCompilerAccessor(types, objectBeingAccessed), propertyBeingAccessed.node.name];
  } else {
    return [];
  }
}

function validateCompilerParameter(parameter,accessPath) {
  if (typeof parameter !== 'boolean') { //Por enquanto esta biblioteca só funciona para expressões em que o parametro é booleano
    throw new Error(`The parameter ${accessPath.join('.')} is not of type boolean. This library is not ready for parameters other than boolean ones`);
  }
}

exports.default = function(babel) {
  var types = babel.types,
    mapKeys = [];
  return {
    visitor: {
      Program: function Program(path, PluginPass) {
        var define = PluginPass.opts.define;

        if (define) {
          mapKeys = Object.getOwnPropertyNames(define());
        }
      },
      Conditional: {
        exit: function exit(path, state) {
          //Basicos de uma implementação de um plugin https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md#toc-paths
          //Nodos de AST para expressões condicionais https://github.com/babel/babel/blob/master/packages/babel-parser/ast/spec.md#conditionalexpression
          //Validar blocos de código if???
          var test = path.get('test') //Obtém a expressao de teste da condicao
          if (types.isMemberExpression(test)) { // Somente expressóes do yipo acesso de membro (a.property.acessor)
            const accessPath = isCompilerAccessor(types, test); //Verifica a variavel e caminho que está sendo acessado
            if (accessPath && accessPath[0] === 'COMPILER') { //Se é a variavel predefinida
              const parameter = accessPath.slice(1).reduce((r, k) => r[k], state.opts.define())[test.get('property').node.name]; //Obtém o parametro acessado
              validateCompilerParameter(parameter, accessPath);
              if (parameter) { //Verifica o valor dessa expressão
                //Se é verdadeiro, substitui a expressão lógica com o resultado da direita
                path.replaceWith(path.get('consequent'));
              } else {
                //Senão substitui a expressão inteira com um valor null (removendo qualquer referência extra oriunda da expressão)
                if (path.get('alternate').node) { //Se existe um else
                  path.replaceWith(path.get('alternate')); //Substitui com else
                } else {
                  path.remove(); //Senão somente remove o nodo
                }
              }
            }
          }
        }
      },
      /**
       * @todo Expressões mais complexas
       * @todo Expressões or (||)
       * @todo Condicionais???
       */
      LogicalExpression: { //Resolve as expressoes logicas left (&& ||) right
        exit: function exit(path, state) {
          //Nodos de AST para expressões lógicas https://github.com/babel/babel/blob/master/packages/babel-parser/ast/spec.md#logicalexpression
          var left = path.get('left'); //Pega o nodo da esquerda de uma validação simples 
          var right = path.get('right'); 
          if (types.isMemberExpression(left)) { //Somente casos em que o nodo da esquerda é um acesso a uma variavel 
            const accessPath = isCompilerAccessor(types, left); //Verifica a variavel e caminho que está sendo acessado
            if (accessPath && accessPath[0] === 'COMPILER') { //Se esta sendo um acesso a variavel pre-definida 'COMPILER' (ex. COMPILER.HomeScreen.BannerAvailable)
              const parameter = accessPath.slice(1).reduce((r, k) => r[k], state.opts.define())[left.get('property').node.name];
              validateCompilerParameter(parameter, accessPath);
              if (path.node.operator !== '&&') { //Por enquanto só funciona para expressões &&
                throw new Error('This library is only compatible with expressions of type && on the format "COMPILER.a.parameter.accessor && THE_RESULT"');
              }
              if (parameter) { //Verifica o valor dessa expressão
                //Se é verdadeiro, substitui a expressão lógica com o resultado da direita
                path.replaceWith(right);
              } else {
                //Senão substitui a expressão inteira com um valor null (removendo qualquer referência extra oriunda da expressão)
                path.replaceWith(types.nullLiteral());
              }
            }
          }
        },
      },
    },
  };
};
