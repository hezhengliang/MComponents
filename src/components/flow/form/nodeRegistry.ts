import { markRaw } from 'vue'
import { z } from 'zod'
import type { NodeRegistryEntry } from './types'

import StartNode from '../nodes/StartNode.vue'
import EndNode from '../nodes/EndNode.vue'
import ProcessNode from '../nodes/ProcessNode.vue'
import ConditionNode from '../nodes/ConditionNode.vue'
import TableNode from '../nodes/TableNode.vue'
import SqlNode from '../nodes/SqlNode.vue'
import JoinNode from '../nodes/JoinNode.vue'
import WhereNode from '../nodes/WhereNode.vue'

const tableOptions = [
  {
    name: 'users',
    fields: [
      { name: 'id', type: 'int', connectable: false },
      { name: 'username', type: 'string', connectable: true },
      { name: 'email', type: 'string', connectable: true },
      { name: 'age', type: 'int', connectable: true },
      { name: 'created_at', type: 'date', connectable: false },
    ],
  },
  {
    name: 'orders',
    fields: [
      { name: 'id', type: 'int', connectable: false },
      { name: 'user_id', type: 'int', connectable: true },
      { name: 'total', type: 'float', connectable: true },
      { name: 'status', type: 'string', connectable: true },
      { name: 'created_at', type: 'date', connectable: false },
    ],
  },
  {
    name: 'products',
    fields: [
      { name: 'id', type: 'int', connectable: false },
      { name: 'name', type: 'string', connectable: true },
      { name: 'price', type: 'float', connectable: true },
      { name: 'stock', type: 'int', connectable: true },
      { name: 'category_id', type: 'int', connectable: true },
    ],
  },
]

export const nodeRegistry: Record<string, NodeRegistryEntry> = {
  start: {
    type: 'start',
    component: markRaw(StartNode),
    icon: 'M8 5v14l11-7z',
    color: '#6366f1',
    label: '开始',
    description: '流程的起始节点。',
    defaultData: () => ({}),
    formMeta: {
      fields: [],
    },
  },
  end: {
    type: 'end',
    component: markRaw(EndNode),
    icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
    color: '#3b82f6',
    label: '结束',
    description: '流程的结束节点。',
    defaultData: () => ({}),
    formMeta: {
      fields: [],
    },
  },
  table: {
    type: 'table',
    component: markRaw(TableNode),
    icon: 'M4 4h16v16H4V4zm2 2v4h4V6H6zm6 0v4h4V6h-4zm6 0v4h4V6h-4zM6 12v4h4v-4H6zm6 0v4h4v-4h-4zm6 0v4h4v-4h-4zM6 18v2h12v-2H6z',
    color: '#f59e0b',
    label: '数据表',
    description: '选择数据表及其字段，作为流程的数据源。',
    defaultData: () => ({
      tableName: '',
      fields: [],
    }),
    formMeta: {
      validateTrigger: 'change',
      validationSchema: z.object({
        tableName: z.string().min(1, '请选择数据表'),
      }),
      fields: [
        {
          name: 'tableName',
          type: 'select',
          label: '数据表',
          placeholder: '请选择数据表',
          options: tableOptions.map(t => ({ label: t.name, value: t.name })),
        },
      ],
      effects: [
        {
          watch: 'tableName',
          run: (values) => {
            const table = tableOptions.find(t => t.name === values.tableName)
            return table ? { fields: table.fields } : {}
          },
        },
      ],
    },
  },
  join: {
    type: 'join',
    component: markRaw(JoinNode),
    icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z',
    color: '#ec4899',
    label: 'Join 连接',
    description: '将两个数据表按指定条件连接。',
    defaultData: () => ({
      joinType: 'LEFT',
      leftTable: '',
      rightTable: '',
      onCondition: '',
    }),
    formMeta: {
      validateTrigger: 'blur',
      validationSchema: z.object({
        leftTable: z.string().min(1, '请输入左表名'),
        rightTable: z.string().min(1, '请输入右表名'),
        onCondition: z.string().min(1, '请输入 ON 条件'),
      }),
      fields: [
        {
          name: 'joinType',
          type: 'select',
          label: 'Join 类型',
          options: [
            { label: 'LEFT JOIN', value: 'LEFT' },
            { label: 'RIGHT JOIN', value: 'RIGHT' },
            { label: 'INNER JOIN', value: 'INNER' },
            { label: 'FULL JOIN', value: 'FULL' },
            { label: 'CROSS JOIN', value: 'CROSS' },
          ],
        },
        {
          name: 'leftTable',
          type: 'text',
          label: '左表',
          placeholder: '输入左表名',
        },
        {
          name: 'rightTable',
          type: 'text',
          label: '右表',
          placeholder: '输入右表名',
        },
        {
          name: 'onCondition',
          type: 'text',
          label: 'ON 条件',
          placeholder: 'a.id = b.id',
        },
      ],
    },
  },
  sql: {
    type: 'sql',
    component: markRaw(SqlNode),
    icon: 'M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z',
    color: '#0ea5e9',
    label: 'SQL 查询',
    description: '编写 SQL 查询语句。',
    defaultData: () => ({
      dialect: 'mysql',
      fromTable: '',
      selectFields: ['*'],
    }),
    formMeta: {
      // 示例：数组字段校验 + 跨字段校验
      validationSchema: z.object({
        fromTable: z.string().min(1, '请输入查询表名'),
        selectFields: z.array(z.string().min(1, '字段不能为空')).min(1, '至少选择一个字段'),
      }).refine((data: any) => {
        // 跨字段校验：如果 dialect 是 sqlite，fromTable 不能以数字开头
        if (data.dialect === 'sqlite') {
          return !/^\d/.test(data.fromTable)
        }
        return true
      }, {
        message: 'SQLite 表名不能以数字开头',
        path: ['fromTable'],
      }),
      fields: [
        {
          name: 'dialect',
          type: 'select',
          label: 'SQL 方言',
          options: [
            { label: 'MySQL', value: 'mysql' },
            { label: 'PostgreSQL', value: 'pg' },
            { label: 'SQLite', value: 'sqlite' },
          ],
        },
        {
          name: 'fromTable',
          type: 'text',
          label: '查询表',
          placeholder: '表名',
        },
        {
          name: 'selectFields',
          type: 'array',
          label: '选择字段',
          placeholder: '添加查询字段',
        },
      ],
    },
  },
  where: {
    type: 'where',
    component: markRaw(WhereNode),
    icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
    color: '#10b981',
    label: 'WHERE 条件',
    description: '对数据添加过滤条件。',
    defaultData: () => ({
      conditions: [],
    }),
    formMeta: {
      // 示例：数组字段校验
      validationSchema: z.object({
        conditions: z.array(
          z.object({
            field: z.string().min(1, '请选择字段'),
            operator: z.string().min(1, '请选择操作符'),
            value: z.string().min(1, '请输入值'),
          })
        ).min(1, '至少添加一个条件'),
      }),
      fields: [
        {
          name: 'conditions',
          type: 'array',
          label: '条件列表',
          placeholder: '暂无过滤条件',
        },
      ],
    },
  },
  process: {
    type: 'process',
    component: markRaw(ProcessNode),
    icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
    color: '#8b5cf6',
    label: '处理节点',
    description: '通用处理节点。',
    defaultData: () => ({
      label: '',
      model: '',
    }),
    formMeta: {
      validationSchema: z.object({
        label: z.string().min(1, '请输入节点名称'),
      }),
      fields: [
        {
          name: 'label',
          type: 'text',
          label: '节点名称',
          placeholder: '输入节点名称',
        },
        {
          name: 'model',
          type: 'text',
          label: '模型',
          placeholder: '模型名称',
        },
      ],
    },
  },
  condition: {
    type: 'condition',
    component: markRaw(ConditionNode),
    icon: 'M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z',
    color: '#14b8a6',
    label: '选择器',
    description: '根据条件判断执行不同分支。',
    defaultData: () => ({
      conditions: [{ label: '如果', field: '', operator: '=', value: '', type: 'if' }],
      hasElse: true,
    }),
    formMeta: {
      fields: [
        {
          name: 'conditions',
          type: 'array',
          label: '分支条件',
          placeholder: '暂无分支条件',
        },
        {
          name: 'hasElse',
          type: 'boolean',
          label: '包含默认分支',
        },
      ],
    },
  },
}

export const draggableNodeTypes = Object.values(nodeRegistry)
  .filter(n => !['start', 'end'].includes(n.type))
  .map(n => ({
    type: n.type,
    label: n.label,
    color: n.color,
    iconPath: n.icon,
  }))

export const nodeComponents = Object.fromEntries(
  Object.values(nodeRegistry).map(n => [n.type, n.component])
)
