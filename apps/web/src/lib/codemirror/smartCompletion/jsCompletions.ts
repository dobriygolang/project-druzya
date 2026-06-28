import { snippetCompletion } from '@codemirror/autocomplete'
import type { Extension } from '@codemirror/state'
import { javascriptLanguage } from '@codemirror/lang-javascript'
import { completion, dotMemberSource, identifierPrefixSource } from './dotMember'

const jsGlobals = [
  completion('console', 'namespace', 'global'),
  completion('JSON', 'namespace', 'global'),
  completion('Math', 'namespace', 'global'),
  completion('Object', 'namespace', 'global'),
  completion('Array', 'namespace', 'global'),
  completion('Promise', 'class', 'global'),
  completion('Map', 'class', 'global'),
  completion('Set', 'class', 'global'),
  completion('parseInt', 'function', 'global'),
  completion('parseFloat', 'function', 'global'),
  completion('isNaN', 'function', 'global'),
  completion('setTimeout', 'function', 'global'),
  completion('clearTimeout', 'function', 'global'),
]

const jsMembers: Record<string, ReturnType<typeof completion>[]> = {
  console: [
    completion('log', 'function', 'console.log'),
    completion('error', 'function', 'console.error'),
    completion('warn', 'function', 'console.warn'),
    completion('info', 'function', 'console.info'),
    completion('debug', 'function', 'console.debug'),
    completion('table', 'function', 'console.table'),
  ],
  JSON: [
    completion('parse', 'function', 'JSON.parse'),
    completion('stringify', 'function', 'JSON.stringify'),
  ],
  Math: [
    completion('max', 'function', 'Math.max'),
    completion('min', 'function', 'Math.min'),
    completion('floor', 'function', 'Math.floor'),
    completion('ceil', 'function', 'Math.ceil'),
    completion('round', 'function', 'Math.round'),
    completion('abs', 'function', 'Math.abs'),
    completion('sqrt', 'function', 'Math.sqrt'),
    completion('random', 'function', 'Math.random'),
  ],
  Object: [
    completion('keys', 'function', 'Object.keys'),
    completion('values', 'function', 'Object.values'),
    completion('entries', 'function', 'Object.entries'),
    completion('assign', 'function', 'Object.assign'),
    completion('fromEntries', 'function', 'Object.fromEntries'),
  ],
  Array: [
    completion('from', 'function', 'Array.from'),
    completion('isArray', 'function', 'Array.isArray'),
    completion('of', 'function', 'Array.of'),
  ],
  Promise: [
    completion('resolve', 'function', 'Promise.resolve'),
    completion('reject', 'function', 'Promise.reject'),
    completion('all', 'function', 'Promise.all'),
    completion('race', 'function', 'Promise.race'),
  ],
}

const jsExtraSnippets = [
  snippetCompletion('const ${name} = (${params}) => {\n\t${}\n}', {
    label: 'arrow fn',
    type: 'keyword',
  }),
  snippetCompletion('async function ${name}(${params}) {\n\t${}\n}', {
    label: 'async function',
    type: 'keyword',
  }),
  snippetCompletion('try {\n\t${}\n} catch (${err}) {\n\t${}\n}', {
    label: 'try/catch',
    type: 'keyword',
  }),
  snippetCompletion('for (const ${item} of ${iter}) {\n\t${}\n}', {
    label: 'for of',
    type: 'keyword',
  }),
]

export const jsSmartCompletion: Extension = [
  javascriptLanguage.data.of({ autocomplete: dotMemberSource(jsMembers) }),
  javascriptLanguage.data.of({ autocomplete: identifierPrefixSource(jsGlobals, { minPrefix: 2 }) }),
  javascriptLanguage.data.of({ autocomplete: jsExtraSnippets }),
]
