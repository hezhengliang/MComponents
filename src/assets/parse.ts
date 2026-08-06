/**
 * query-builder-linq-parser.ts
 *
 * 把 jQuery-QueryBuilder 风格的规则树转成 C# LINQ 表达式字符串。
 * TypeScript / ESM 版本，支持复杂方法链：Where、Any、All、Min、Max、
 * Sum、Average、Count、Select、OrderBy、GroupBy、Take、Skip 等。
 */

export type LogicCondition = 'AND' | 'OR';

export interface SimpleRule {
  field: string;
  operator: string;
  value?: unknown;
}

export interface RuleGroup {
  condition: LogicCondition;
  rules: QueryRule[];
  /** 对应 jQuery-QueryBuilder 的 not-group 插件 */
  not?: boolean;
  /** 对应 jQuery-QueryBuilder 的 valid 字段 */
  valid?: boolean;
}

export interface CollectionRule {
  field: string;
  operator: 'any' | 'not_any' | 'all' | 'not_all';
  rules: QueryRule[];
}

export interface AggregateRule {
  field: string;
  aggregate: 'count' | 'min' | 'max' | 'sum' | 'avg' | 'average';
  aggregateField?: string;
  operator?: string;
  value?: unknown;
  /** 仅对 Count 有效：Count(x => x.Amount > 0) */
  predicate?: RuleGroup | SimpleRule | CollectionRule | AggregateRule;
}

export type QueryRule = SimpleRule | RuleGroup | CollectionRule | AggregateRule;

export interface ChainCall {
  method:
    | 'where'
    | 'any'
    | 'all'
    | 'select'
    | 'selectMany'
    | 'orderBy'
    | 'orderByDescending'
    | 'thenBy'
    | 'thenByDescending'
    | 'groupBy'
    | 'join'
    | 'groupJoin'
    | 'take'
    | 'skip'
    | 'distinct'
    | 'reverse'
    | 'first'
    | 'firstOrDefault'
    | 'single'
    | 'singleOrDefault'
    | 'last'
    | 'lastOrDefault'
    | 'count'
    | 'min'
    | 'max'
    | 'sum'
    | 'average'
    | string;
  /** Where / Any / All 的过滤规则 */
  rules?: QueryRule[];
  /** Select / OrderBy / GroupBy 的选择器 */
  selector?: string;
  /** OrderBy / GroupBy 的字段名 */
  field?: string;
  /** GroupBy 的元素选择器 */
  elementSelector?: string;
  /** Join / GroupJoin 的内表数据源 */
  inner?: string;
  /** Join / GroupJoin 外表 Key 选择器 */
  outerKeySelector?: string;
  /** Join / GroupJoin 内表 Key 选择器 */
  innerKeySelector?: string;
  /** Join / GroupJoin 结果选择器 */
  resultSelector?: string;
  /** Take / Skip 的数字 */
  count?: number;
  /** 通用参数，用于不常见的扩展方法 */
  args?: string;
  /** 自定义条件（默认 AND） */
  condition?: LogicCondition;
}

export interface QueryChain {
  source?: string;
  calls: ChainCall[];
}

export interface OperatorDef {
  linq: string;
  method?: boolean;
  special?: 'in' | 'between';
  negation?: boolean;
}

export interface ParserOptions {
  source?: string;
  paramName?: string;
  /** 字段是否自动转 PascalCase，默认 true */
  toPascalCase?: boolean;
  /** 嵌套 lambda 参数名序列，默认 ['x','y','z','w','v','u'] */
  lambdaVars?: string[];
  /** 字段映射，如 { uid: 'UserId' } */
  fieldMap?: Record<string, string>;
  /** 扩展或覆盖操作符 */
  operators?: Record<string, OperatorDef>;
}

const DEFAULT_OPERATORS: Record<string, OperatorDef> = {
  equal: { linq: '==' },
  not_equal: { linq: '!=' },
  less: { linq: '<' },
  less_or_equal: { linq: '<=' },
  greater: { linq: '>' },
  greater_or_equal: { linq: '>=' },
  begins_with: { linq: 'StartsWith', method: true },
  not_begins_with: { linq: 'StartsWith', method: true, negation: true },
  contains: { linq: 'Contains', method: true },
  not_contains: { linq: 'Contains', method: true, negation: true },
  ends_with: { linq: 'EndsWith', method: true },
  not_ends_with: { linq: 'EndsWith', method: true, negation: true },
  in: { linq: 'In', special: 'in' },
  not_in: { linq: 'In', special: 'in', negation: true },
  between: { linq: 'Between', special: 'between' },
  not_between: { linq: 'Between', special: 'between', negation: true },
  is_null: { linq: '== null' },
  is_not_null: { linq: '!= null' },
  is_empty: { linq: '== ""' },
  is_not_empty: { linq: '!= ""' },
};

const COLLECTION_OPERATORS: Record<string, string> = {
  any: 'Any',
  not_any: 'Any',
  all: 'All',
  not_all: 'All',
};

const AGGREGATE_OPERATORS: Record<string, string> = {
  count: 'Count',
  min: 'Min',
  max: 'Max',
  sum: 'Sum',
  avg: 'Average',
  average: 'Average',
};

const PREDICATE_METHODS = new Set(['Where', 'Any', 'All']);
const SELECTOR_METHODS = new Set([
  'Select',
  'SelectMany',
  'OrderBy',
  'OrderByDescending',
  'ThenBy',
  'ThenByDescending',
  'GroupBy',
]);
const FIELD_METHODS = new Set(['Min', 'Max', 'Sum', 'Average']);
const NO_ARGS_METHODS = new Set([
  'Count',
  'LongCount',
  'Distinct',
  'Reverse',
  'First',
  'FirstOrDefault',
  'Single',
  'SingleOrDefault',
  'Last',
  'LastOrDefault',
]);

export class QueryBuilderLinqParser {
  private operators: Record<string, OperatorDef>;
  private toPascalCase: boolean;
  private paramName: string;
  private lambdaVars: string[];
  private fieldMap: Record<string, string>;
  private source: string;

  constructor(options: ParserOptions = {}) {
    this.operators = { ...DEFAULT_OPERATORS, ...(options.operators || {}) };
    this.toPascalCase = options.toPascalCase !== false;
    this.paramName = options.paramName || 'x';
    this.lambdaVars = options.lambdaVars || ['x', 'y', 'z', 'w', 'v', 'u'];
    this.fieldMap = options.fieldMap || {};
    this.source = options.source || 'source';
  }

  /**
   * 把规则树转成带 Where 的 LINQ 表达式。
   */
  toLinq(rules: QueryRule | RuleGroup, options: { source?: string; predicateOnly?: boolean } = {}): string {
    const source = options.source ?? this.source;
    const predicate = this.buildPredicate(rules, 0);
    if (options.predicateOnly) return predicate;
    return `${source}.Where(${this.paramName} => ${predicate})`;
  }

  /**
   * 把规则树转成纯 lambda 谓词字符串。
   */
  buildPredicate(node: QueryRule | RuleGroup | null | undefined, depth = 0): string {
    if (!node) return 'true';

    // 集合谓词：any / not_any / all / not_all（必须先判断，因为它们也包含 rules）
    if ('operator' in node && COLLECTION_OPERATORS[node.operator]) {
      const collectionOp = node as CollectionRule;
      const field = this.fieldRef(collectionOp.field, depth);
      const method = COLLECTION_OPERATORS[collectionOp.operator];
      const negated = collectionOp.operator.startsWith('not_');
      const innerDepth = depth + 1;
      const innerParam = this.lambdaParam(innerDepth);
      const innerPredicate = this.buildInnerRules(collectionOp.rules, innerDepth) || 'true';
      const expr = `${field}.${method}(${innerParam} => ${innerPredicate})`;
      return negated ? `!${expr}` : expr;
    }

    // 组合条件：AND / OR（没有 condition 但有 rules 时默认按 AND 处理）
    if ('rules' in node && Array.isArray(node.rules)) {
      const group = node as RuleGroup;
      if (group.rules.length === 0) return group.not ? 'false' : 'true';
      const sep = group.condition === 'OR' ? ' || ' : ' && ';
      const expr = group.rules.map((r) => `(${this.buildPredicate(r, depth)})`).join(sep);
      return group.not ? `!(${expr})` : expr;
    }

    // 聚合比较：count / min / max / sum / avg
    if ('aggregate' in node && node.aggregate && AGGREGATE_OPERATORS[node.aggregate]) {
      const aggRule = node as AggregateRule;
      const expr = this.buildAggregateExpression(aggRule, depth);
      if (aggRule.operator) {
        const op = this.operators[aggRule.operator];
        if (!op) throw new Error(`Unsupported operator: ${aggRule.operator}`);
        const val = this.valueLiteral(aggRule.value);
        return `${expr} ${op.linq} ${val}`;
      }
      return expr;
    }

    // 普通字段条件
    if ('field' in node && 'operator' in node) {
      return this.simplePredicate(node as SimpleRule, depth);
    }

    return 'true';
  }

  /**
   * 构建完整 LINQ 方法链。
   */
  buildQuery(spec: QueryChain): string {
    if (!spec || !Array.isArray(spec.calls)) return '';
    let chain = spec.source ?? this.source;
    for (const call of spec.calls) {
      chain = this.appendCall(chain, call, 0);
    }
    return chain;
  }

  private appendCall(chain: string, call: ChainCall, depth: number): string {
    const method = this.capitalize(call.method || 'Where');

    if (PREDICATE_METHODS.has(method)) {
      const param = this.lambdaParam(depth);
      const predicate = this.buildPredicate(
        call.rules && call.rules.length > 0
          ? { condition: call.condition || 'AND', rules: call.rules }
          : undefined,
        depth
      );
      return `${chain}.${method}(${param} => ${predicate})`;
    }

    if (SELECTOR_METHODS.has(method)) {
      const param = this.lambdaParam(depth);

      if (method === 'GroupBy') {
        // GroupBy(x => x.Category)
        // GroupBy(x => x.Category, x => x.Name)
        // GroupBy(x => x.Category, (key, g) => new { ... })
        if (call.args) return `${chain}.GroupBy(${call.args})`;
        const keySelector = call.selector || (call.field ? `${param} => ${this.fieldRef(call.field, depth)}` : param);
        if (call.elementSelector) {
          return `${chain}.GroupBy(${keySelector}, ${call.elementSelector})`;
        }
        return `${chain}.GroupBy(${keySelector})`;
      }

      const selector = call.selector || (call.field ? `${param} => ${this.fieldRef(call.field, depth)}` : param);
      return `${chain}.${method}(${selector})`;
    }

    // Join / GroupJoin
    if (method === 'Join' || method === 'GroupJoin') {
      if (call.args) return `${chain}.${method}(${call.args})`;
      const inner = call.inner ?? 'inner';
      const param = this.lambdaParam(depth);
      const nextParam = this.lambdaParam(depth + 1);
      const outerKey = call.outerKeySelector ?? `${param} => ${param}.Id`;
      const innerKey = call.innerKeySelector ?? `${nextParam} => ${nextParam}.Id`;
      const result = call.resultSelector ?? `(${param}, ${nextParam}) => new { ${param}, ${nextParam} }`;
      return `${chain}.${method}(${inner}, ${outerKey}, ${innerKey}, ${result})`;
    }

    if (FIELD_METHODS.has(method)) {
      const param = this.lambdaParam(depth);
      if (call.field) {
        return `${chain}.${method}(${param} => ${this.fieldRef(call.field, depth)})`;
      }
      if (call.args) {
        return `${chain}.${method}(${call.args})`;
      }
      return `${chain}.${method}()`;
    }

    if (NO_ARGS_METHODS.has(method)) {
      return `${chain}.${method}()`;
    }

    if (['Take', 'Skip'].includes(method)) {
      const arg = call.args ?? call.count ?? '';
      return `${chain}.${method}(${arg})`;
    }

    if (['TakeWhile', 'SkipWhile'].includes(method)) {
      const param = this.lambdaParam(depth);
      const arg = call.args ?? call.selector ?? '';
      return `${chain}.${method}(${param} => ${arg})`;
    }

    // 兜底
    return `${chain}.${method}(${call.args ?? ''})`;
  }

  private buildInnerRules(rules: QueryRule[] | undefined, depth: number): string {
    if (!Array.isArray(rules) || rules.length === 0) return '';
    if (rules.length === 1) return this.buildPredicate(rules[0], depth);
    return this.buildPredicate({ condition: 'AND', rules }, depth);
  }

  private buildAggregateExpression(node: AggregateRule, depth: number): string {
    const field = this.fieldRef(node.field, depth);
    const method = AGGREGATE_OPERATORS[node.aggregate];

    if (method === 'Count' && node.predicate) {
      const innerParam = this.lambdaParam(depth + 1);
      return `${field}.${method}(${innerParam} => ${this.buildPredicate(node.predicate, depth + 1)})`;
    }

    if (node.aggregateField) {
      const innerParam = this.lambdaParam(depth + 1);
      const innerField = this.fieldRef(node.aggregateField, depth + 1);
      return `${field}.${method}(${innerParam} => ${innerField})`;
    }

    return `${field}.${method}()`;
  }

  private simplePredicate(rule: SimpleRule, depth: number): string {
    const op = this.operators[rule.operator];
    if (!op) throw new Error(`Unsupported operator: ${rule.operator}`);

    const fieldExpr = this.fieldRef(rule.field, depth);

    if (op.special === 'in') {
      const arr = Array.isArray(rule.value) ? rule.value : [rule.value];
      const items = arr.map((v) => this.valueLiteral(v)).join(', ');
      const expr = `new[] { ${items} }.Contains(${fieldExpr})`;
      return op.negation ? `!${expr}` : expr;
    }

    if (op.special === 'between') {
      const arr = Array.isArray(rule.value) ? rule.value : [rule.value, rule.value];
      const a = this.valueLiteral(arr[0]);
      const b = this.valueLiteral(arr[1] ?? arr[0]);
      const expr = `${fieldExpr} >= ${a} && ${fieldExpr} <= ${b}`;
      return op.negation ? `!(${expr})` : expr;
    }

    if (op.method) {
      const valExpr = this.valueLiteral(rule.value);
      const expr = `${fieldExpr}.${op.linq}(${valExpr})`;
      return op.negation ? `!${expr}` : expr;
    }

    // is_null / is_not_null / is_empty / is_not_empty 的 op.linq 已包含值
    if (rule.operator.startsWith('is_')) {
      return `${fieldExpr} ${op.linq}`;
    }

    const valExpr = this.valueLiteral(rule.value);
    return `${fieldExpr} ${op.linq} ${valExpr}`;
  }

  private fieldRef(field: string | undefined, depth: number): string {
    if (!field) return '';
    if (typeof field === 'function') return (field as (p: string) => string)(this.lambdaParam(depth));

    const mapped = this.fieldMap[field] || field;
    const name = this.toPascalCase ? this.toPascal(mapped) : mapped;
    const param = depth === 0 ? this.paramName : this.lambdaParam(depth);
    return `${param}.${name}`;
  }

  private toPascal(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .split('_')
      .map((s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : ''))
      .join('');
  }

  private lambdaParam(depth: number): string {
    return this.lambdaVars[Math.min(depth, this.lambdaVars.length - 1)] || 'x';
  }

  private valueLiteral(value: unknown): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (value instanceof Date) return `DateTime.Parse("${value.toISOString()}")`;
    if (Array.isArray(value)) {
      return `new[] { ${value.map((v) => this.valueLiteral(v)).join(', ')} }`;
    }
    return String(value);
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

export default QueryBuilderLinqParser;

