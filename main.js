define(function(reuire, exports, module) {
    'use strict';

    var LanguageManager = brackets.getModule('language/LanguageManager');
    var CodeMirror = brackets.getModule('thirdparty/CodeMirror2/lib/codemirror');
    var ExtensionUtils = brackets.getModule('utils/ExtensionUtils');
    
    CodeMirror.defineMode('cmake', function (config) {
        var keywords = {};
        
        ['if', 'else', 'elseif', 'endif'].forEach(function (cmd) {
            keywords[cmd] = [
                'NOT','AND', 'OR', 'COMMAND', 'POLICY', 'TARGET',
                'EXISTS', 'IS_NEWER_THAN', 'IS_DIRECTORY', 'IS_SYMLINK',
                'IS_ABSOLUTE', 'MATCHES', 'LESS', 'GREATER', 'EQUAL',
                'STRLESS', 'STRGREATER', 'STREQUAL', 'VERSION_LESS',
                'VERSION_EQUAL', 'VERSION_GREATER', 'DEFINED'
            ];
        });

        ExtensionUtils.loadFile(module, 'commands.json').then(function (data) {
            $.each(JSON.parse(data), function (cmd, args) {
                keywords[cmd] = (keywords[cmd] || []).concat(args);
            });
        });

        var COMMENT  = { name: 'COMMENT',  regexp: /#/ };
        var QUOTE    = { name: 'QUOTE',    regexp: /"/ };
        var OBRACKET = { name: 'OBRACKET', regexp: /\[([=]*)\[/ };
        var CBRACKET = { name: 'CBRACKET', regexp: /\]([=]*)\]/ };
        var SPACE    = { name: 'SPACE',    regexp: /\s+/ };
        var LPAREN   = { name: 'LPAREN',   regexp: /\(/ };
        var RPAREN   = { name: 'RPAREN',   regexp: /\)/ };
        var IDENT    = { name: 'IDENT',    regexp: /[A-Za-z_][A-Za-z0-9_]*/ };
        var VARREF   = { name: 'VARREF',   regexp: /\$(ENV)?{.*?}/ };
        var ARGUMENT = { name: 'ARGUMENT', regexp: /[^()#"\\]+/ };

        COMMENT.handle = function (stream, state, token) {
            if (token.matchRule(OBRACKET)) {
                state.inBracketComment = true;
                state.bracketLength = token.match[0].length;
                token.class = 'comment';
            } else {
                stream.skipToEnd();
                token.class = 'comment';
            }
        }

        QUOTE.handle = function (stream, state, token) {
            state.inString = true;
            token.class = 'string';
        }

        OBRACKET.handle = function (stream, state, token) {
            state.inBracketString = true;
            token.class = 'string';
        }

        LPAREN.handle = function (stream, state, token) {
            state.parenBalance++;
        }

        RPAREN.handle = function (stream, state, token) {
            state.parenBalance--;
            if (state.parenBalance == 0) {
                state.command = null;
            }
        }

        IDENT.handle = function (stream, state, token) {
            if (state.command) {
                var keyword = stream.current();
                if (keywords.hasOwnProperty(state.command)
                    && keywords[state.command].indexOf(keyword) >= 0) {
                    token.class = 'keyword';
                }
            } else {
                stream.eatSpace();
                if (token.matchRule(LPAREN)) {
                    stream.backUp(1);
                    state.command = stream.current();
                    token.class = 'keyword';
                }
            }
        }

        VARREF.handle = function (stream, state, token) {
            token.class = 'variable';
        }

        var rules = [
            COMMENT, QUOTE, OBRACKET, CBRACKET, SPACE, LPAREN,
            RPAREN, IDENT, VARREF, ARGUMENT
        ];

        return {
            token: function (stream, state) {
                var token = {
                    rule: null,
                    class: null,
                    match: null,
                    matchRule: function(rule) {
                        if ((token.match = stream.match(rule.regexp))) {
                            token.rule = rule;
                            return token.match;
                        }
                        return (token.match = null);
                    }
                };

                if (state.inString) {
                    token.class = 'string';
                    if (token.matchRule(QUOTE)) {
                        state.inString = false;
                    } else {
                        stream.next();
                    }
                } else if (state.inBracketString) {
                    token.class = 'string';
                    if (token.matchRule(CBRACKET)) {
                        state.inBracketString = false;
                    } else {
                        stream.next();
                    }
                } else if (state.inBracketComment) {
                    token.class = 'comment';
                    if (token.matchRule(CBRACKET)
                        && token.match[0].length == state.bracketLength) {
                        state.inBracketComment = false;
                    } else {
                        stream.next();
                    }
                } else {               
                    rules.every(function(r) {
                        if (token.matchRule(r) && r.hasOwnProperty('handle')) {
                            r.handle(stream, state, token);
                        }
                        return !token.match;
                    });
                }

                return token.class;
            },

            startState: function () {
                return {
                    inString: false,
                    inBracketString: false,
                    inBracketComment: false,
                    command: null,
                    bracketLength: 0,
                    parenBalance: 0
                };
            },   

            lineComment: '#'
        };
    });

    CodeMirror.defineMIME('text/x-cmake', 'cmake');

    LanguageManager.defineLanguage('cmake', {
        name: 'CMake',
        mode: 'cmake',
        fileExtensions: ['cmake', 'cmake.in'],
        fileNames: ['CMakeLists.txt'],
        lineComment: ['#']
    });
});
