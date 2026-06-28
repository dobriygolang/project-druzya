import { snippetCompletion } from '@codemirror/autocomplete'
import type { Extension } from '@codemirror/state'
import { goLanguage } from '@codemirror/lang-go'
import { completion, dotMemberSource, identifierPrefixSource } from './dotMember'

const goPackages: ReturnType<typeof completion>[] = [
  completion('fmt', 'namespace', 'import', 'Formatted I/O'),
  completion('strings', 'namespace', 'import', 'String utilities'),
  completion('strconv', 'namespace', 'import', 'String conversions'),
  completion('sort', 'namespace', 'import', 'Sort helpers'),
  completion('os', 'namespace', 'import', 'OS interface'),
  completion('math', 'namespace', 'import', 'Math functions'),
  completion('errors', 'namespace', 'import', 'Error values'),
  completion('sync', 'namespace', 'import', 'Synchronization'),
  completion('bytes', 'namespace', 'import', 'Byte slices'),
  completion('bufio', 'namespace', 'import', 'Buffered I/O'),
  completion('io', 'namespace', 'import', 'I/O primitives'),
  completion('context', 'namespace', 'import', 'Context propagation'),
  completion('time', 'namespace', 'import', 'Time and duration'),
  completion('encoding/json', 'namespace', 'import', 'JSON codec'),
  completion('net/http', 'namespace', 'import', 'HTTP client/server'),
  completion('regexp', 'namespace', 'import', 'Regular expressions'),
  completion('unicode', 'namespace', 'import', 'Unicode helpers'),
]

const goMembers: Record<string, ReturnType<typeof completion>[]> = {
  fmt: [
    completion('Print', 'function', 'fmt.Print', 'Print to stdout'),
    completion('Println', 'function', 'fmt.Println', 'Print line to stdout'),
    completion('Printf', 'function', 'fmt.Printf', 'Formatted print'),
    completion('Sprintf', 'function', 'fmt.Sprintf', 'Format to string'),
    completion('Fprintln', 'function', 'fmt.Fprintln', 'Print line to Writer'),
    completion('Fprintf', 'function', 'fmt.Fprintf', 'Formatted print to Writer'),
    completion('Errorf', 'function', 'fmt.Errorf', 'Create formatted error'),
  ],
  strings: [
    completion('Contains', 'function', 'strings.Contains'),
    completion('HasPrefix', 'function', 'strings.HasPrefix'),
    completion('HasSuffix', 'function', 'strings.HasSuffix'),
    completion('Split', 'function', 'strings.Split'),
    completion('SplitN', 'function', 'strings.SplitN'),
    completion('Join', 'function', 'strings.Join'),
    completion('TrimSpace', 'function', 'strings.TrimSpace'),
    completion('Replace', 'function', 'strings.Replace'),
    completion('ReplaceAll', 'function', 'strings.ReplaceAll'),
    completion('ToLower', 'function', 'strings.ToLower'),
    completion('ToUpper', 'function', 'strings.ToUpper'),
    completion('Builder', 'class', 'strings.Builder'),
  ],
  strconv: [
    completion('Atoi', 'function', 'strconv.Atoi'),
    completion('Itoa', 'function', 'strconv.Itoa'),
    completion('ParseInt', 'function', 'strconv.ParseInt'),
    completion('FormatInt', 'function', 'strconv.FormatInt'),
    completion('ParseFloat', 'function', 'strconv.ParseFloat'),
    completion('FormatFloat', 'function', 'strconv.FormatFloat'),
  ],
  sort: [
    completion('Ints', 'function', 'sort.Ints'),
    completion('Float64s', 'function', 'sort.Float64s'),
    completion('Strings', 'function', 'sort.Strings'),
    completion('Slice', 'function', 'sort.Slice'),
    completion('SearchInts', 'function', 'sort.SearchInts'),
    completion('IsSorted', 'function', 'sort.IsSorted'),
  ],
  os: [
    completion('Exit', 'function', 'os.Exit'),
    completion('Getenv', 'function', 'os.Getenv'),
    completion('ReadFile', 'function', 'os.ReadFile'),
    completion('WriteFile', 'function', 'os.WriteFile'),
    completion('Stdin', 'constant', 'os.Stdin'),
    completion('Stdout', 'constant', 'os.Stdout'),
    completion('Stderr', 'constant', 'os.Stderr'),
  ],
  math: [
    completion('Max', 'function', 'math.Max'),
    completion('Min', 'function', 'math.Min'),
    completion('Abs', 'function', 'math.Abs'),
    completion('Sqrt', 'function', 'math.Sqrt'),
    completion('Pow', 'function', 'math.Pow'),
    completion('Floor', 'function', 'math.Floor'),
    completion('Ceil', 'function', 'math.Ceil'),
  ],
  errors: [
    completion('New', 'function', 'errors.New'),
    completion('Is', 'function', 'errors.Is'),
    completion('As', 'function', 'errors.As'),
    completion('Unwrap', 'function', 'errors.Unwrap'),
  ],
  sync: [
    completion('Mutex', 'class', 'sync.Mutex'),
    completion('RWMutex', 'class', 'sync.RWMutex'),
    completion('WaitGroup', 'class', 'sync.WaitGroup'),
    completion('Once', 'class', 'sync.Once'),
    completion('Map', 'class', 'sync.Map'),
  ],
  bytes: [
    completion('Compare', 'function', 'bytes.Compare'),
    completion('Contains', 'function', 'bytes.Contains'),
    completion('Equal', 'function', 'bytes.Equal'),
    completion('Join', 'function', 'bytes.Join'),
  ],
  io: [
    completion('EOF', 'constant', 'io.EOF'),
    completion('Copy', 'function', 'io.Copy'),
    completion('ReadAll', 'function', 'io.ReadAll'),
    completion('WriteString', 'function', 'io.WriteString'),
  ],
  context: [
    completion('Background', 'function', 'context.Background'),
    completion('TODO', 'function', 'context.TODO'),
    completion('WithCancel', 'function', 'context.WithCancel'),
    completion('WithTimeout', 'function', 'context.WithTimeout'),
    completion('WithValue', 'function', 'context.WithValue'),
  ],
  time: [
    completion('Now', 'function', 'time.Now'),
    completion('Sleep', 'function', 'time.Sleep'),
    completion('Since', 'function', 'time.Since'),
    completion('Until', 'function', 'time.Until'),
    completion('Second', 'constant', 'time.Second'),
    completion('Minute', 'constant', 'time.Minute'),
    completion('Hour', 'constant', 'time.Hour'),
    completion('Duration', 'type', 'time.Duration'),
    completion('Time', 'type', 'time.Time'),
  ],
  'encoding/json': [
    completion('Marshal', 'function', 'json.Marshal'),
    completion('Unmarshal', 'function', 'json.Unmarshal'),
    completion('NewEncoder', 'function', 'json.NewEncoder'),
    completion('NewDecoder', 'function', 'json.NewDecoder'),
  ],
  'net/http': [
    completion('Get', 'function', 'http.Get'),
    completion('Post', 'function', 'http.Post'),
    completion('HandleFunc', 'function', 'http.HandleFunc'),
    completion('ListenAndServe', 'function', 'http.ListenAndServe'),
    completion('StatusOK', 'constant', 'http.StatusOK'),
  ],
}

const goExtraSnippets = [
  snippetCompletion('for _, ${v} := range ${iter} {\n\t${}\n}', {
    label: 'for range',
    detail: 'range loop',
    type: 'keyword',
  }),
  snippetCompletion('make([]${type}, 0)', {
    label: 'make slice',
    detail: 'empty slice',
    type: 'keyword',
  }),
  snippetCompletion('make(map[${key}]${value})', {
    label: 'make map',
    detail: 'empty map',
    type: 'keyword',
  }),
  snippetCompletion('if err != nil {\n\treturn ${err}\n}', {
    label: 'if err',
    detail: 'error check',
    type: 'keyword',
  }),
  snippetCompletion('import (\n\t"fmt"\n)', {
    label: 'import block',
    detail: 'fmt',
    type: 'keyword',
  }),
]

export const goSmartCompletion: Extension = [
  goLanguage.data.of({ autocomplete: dotMemberSource(goMembers) }),
  goLanguage.data.of({ autocomplete: identifierPrefixSource(goPackages, { minPrefix: 2 }) }),
  goLanguage.data.of({ autocomplete: goExtraSnippets }),
]
