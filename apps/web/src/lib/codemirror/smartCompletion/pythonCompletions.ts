import { snippetCompletion } from '@codemirror/autocomplete'
import type { Extension } from '@codemirror/state'
import { pythonLanguage } from '@codemirror/lang-python'
import { completion, dotMemberSource, identifierPrefixSource } from './dotMember'

const pythonModules = [
  completion('os', 'namespace', 'import'),
  completion('sys', 'namespace', 'import'),
  completion('json', 'namespace', 'import'),
  completion('math', 'namespace', 'import'),
  completion('re', 'namespace', 'import'),
  completion('collections', 'namespace', 'import'),
  completion('itertools', 'namespace', 'import'),
  completion('functools', 'namespace', 'import'),
  completion('typing', 'namespace', 'import'),
  completion('datetime', 'namespace', 'import'),
  completion('heapq', 'namespace', 'import'),
  completion('bisect', 'namespace', 'import'),
]

const pythonMembers: Record<string, ReturnType<typeof completion>[]> = {
  json: [
    completion('loads', 'function', 'json.loads'),
    completion('dumps', 'function', 'json.dumps'),
    completion('load', 'function', 'json.load'),
    completion('dump', 'function', 'json.dump'),
  ],
  os: [
    completion('path', 'namespace', 'os.path'),
    completion('getenv', 'function', 'os.getenv'),
    completion('listdir', 'function', 'os.listdir'),
  ],
  'os.path': [
    completion('join', 'function', 'os.path.join'),
    completion('exists', 'function', 'os.path.exists'),
    completion('basename', 'function', 'os.path.basename'),
    completion('dirname', 'function', 'os.path.dirname'),
  ],
  sys: [
    completion('stdin', 'variable', 'sys.stdin'),
    completion('stdout', 'variable', 'sys.stdout'),
    completion('argv', 'variable', 'sys.argv'),
  ],
  math: [
    completion('sqrt', 'function', 'math.sqrt'),
    completion('ceil', 'function', 'math.ceil'),
    completion('floor', 'function', 'math.floor'),
    completion('gcd', 'function', 'math.gcd'),
    completion('inf', 'constant', 'math.inf'),
  ],
  collections: [
    completion('defaultdict', 'class', 'collections.defaultdict'),
    completion('Counter', 'class', 'collections.Counter'),
    completion('deque', 'class', 'collections.deque'),
    completion('OrderedDict', 'class', 'collections.OrderedDict'),
  ],
  typing: [
    completion('List', 'type', 'typing.List'),
    completion('Dict', 'type', 'typing.Dict'),
    completion('Optional', 'type', 'typing.Optional'),
    completion('Tuple', 'type', 'typing.Tuple'),
    completion('Set', 'type', 'typing.Set'),
  ],
  datetime: [
    completion('datetime', 'class', 'datetime.datetime'),
    completion('timedelta', 'class', 'datetime.timedelta'),
  ],
}

const pythonBuiltins = [
  completion('print', 'function', 'built-in'),
  completion('len', 'function', 'built-in'),
  completion('range', 'function', 'built-in'),
  completion('enumerate', 'function', 'built-in'),
  completion('zip', 'function', 'built-in'),
  completion('map', 'function', 'built-in'),
  completion('filter', 'function', 'built-in'),
  completion('sorted', 'function', 'built-in'),
  completion('sum', 'function', 'built-in'),
  completion('min', 'function', 'built-in'),
  completion('max', 'function', 'built-in'),
  completion('abs', 'function', 'built-in'),
  completion('int', 'function', 'built-in'),
  completion('str', 'function', 'built-in'),
  completion('list', 'function', 'built-in'),
  completion('dict', 'function', 'built-in'),
  completion('set', 'function', 'built-in'),
  completion('tuple', 'function', 'built-in'),
  completion('isinstance', 'function', 'built-in'),
  completion('type', 'function', 'built-in'),
  completion('open', 'function', 'built-in'),
  completion('any', 'function', 'built-in'),
  completion('all', 'function', 'built-in'),
  completion('reversed', 'function', 'built-in'),
]

const pythonExtraSnippets = [
  snippetCompletion('if __name__ == "__main__":\n\t${}', {
    label: 'main guard',
    type: 'keyword',
  }),
  snippetCompletion('def ${name}(${params}):\n\t${}', {
    label: 'def',
    detail: 'function',
    type: 'keyword',
  }),
  snippetCompletion('for ${i} in ${iter}:\n\t${}', {
    label: 'for in',
    type: 'keyword',
  }),
  snippetCompletion('while ${}:\n\t${}', {
    label: 'while',
    type: 'keyword',
  }),
]

export const pythonSmartCompletion: Extension = [
  pythonLanguage.data.of({ autocomplete: dotMemberSource(pythonMembers) }),
  pythonLanguage.data.of({ autocomplete: identifierPrefixSource(pythonModules, { minPrefix: 2 }) }),
  pythonLanguage.data.of({ autocomplete: identifierPrefixSource(pythonBuiltins, { minPrefix: 2 }) }),
  pythonLanguage.data.of({ autocomplete: pythonExtraSnippets }),
]
