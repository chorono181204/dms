import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'

const VariableComponent = ({ node, updateAttributes }: any) => {
    return (
        <NodeViewWrapper as="span" className="variable-component" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
            <input
                className="variable-input"
                placeholder={node.attrs.label}
                value={node.attrs.value || ''}
                onChange={(e) => updateAttributes({ value: e.target.value })}
                style={{
                    border: '1px solid #d9d9d9',
                    borderBottom: '2px solid #1677ff',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    margin: '0 2px',
                    outline: 'none',
                    color: '#1f1f1f',
                    background: '#ffffff',
                    fontSize: 'inherit',
                    minWidth: '60px',
                    width: `${Math.max((node.attrs.value || '').length, node.attrs.label.length) * 8 + 40}px`,
                    transition: 'all 0.3s',
                }}
                onFocus={(e) => {
                    e.target.style.borderColor = '#4096ff'
                    e.target.style.boxShadow = '0 0 0 2px rgba(5, 145, 255, 0.1)'
                }}
                onBlur={(e) => {
                    e.target.style.borderColor = '#d9d9d9'
                    e.target.style.borderBottomColor = '#1677ff'
                    e.target.style.boxShadow = 'none'
                }}
            />
        </NodeViewWrapper>
    )
}

export default Node.create({
    name: 'variable',

    group: 'inline',

    inline: true,

    atom: true,

    addAttributes() {
        return {
            label: {
                default: 'Field',
            },
            value: {
                default: '',
            },
        }
    },

    parseHTML() {
        return [
            {
                tag: 'variable-input',
            },
        ]
    },

    renderHTML({ HTMLAttributes }) {
        return ['variable-input', mergeAttributes(HTMLAttributes)]
    },

    addNodeView() {
        return ReactNodeViewRenderer(VariableComponent)
    },
})
