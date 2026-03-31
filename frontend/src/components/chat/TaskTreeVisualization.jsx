import React, { useMemo, useCallback } from 'react';
import ReactFlow, {
  Background,
  MarkerType,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import { Search, BrainCircuit, CheckCircle2, Loader2, XCircle, Wrench, Sparkles, Clock } from 'lucide-react';

// ─── DAGRE LAYOUT ────────────────────────────────────────────────────────────
const NODE_WIDTH = 220;
const NODE_HEIGHT = 72;

function getLayoutedElements(nodes, edges) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'TB',
    nodesep: 60,
    ranksep: 80,
    marginx: 30,
    marginy: 30,
  });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

// ─── STATUS CONFIG ───────────────────────────────────────────────────────────
const STATUS = {
  pending: {
    bg: 'bg-zinc-900/90',
    border: 'border-zinc-700/60',
    glow: '',
    text: 'text-zinc-500',
    icon: <Clock size={11} className="text-zinc-600" />,
    label: 'Queued',
    dot: 'bg-zinc-600',
  },
  processing: {
    bg: 'bg-[#0c1a2e]',
    border: 'border-blue-500/40',
    glow: 'shadow-[0_0_20px_-4px_rgba(59,130,246,0.25)]',
    text: 'text-blue-300',
    icon: <Loader2 size={11} className="animate-spin text-blue-400" />,
    label: 'Running',
    dot: 'bg-blue-500 animate-pulse',
  },
  completed: {
    bg: 'bg-[#0a1a15]',
    border: 'border-emerald-500/30',
    glow: '',
    text: 'text-emerald-300',
    icon: <CheckCircle2 size={11} className="text-emerald-400" />,
    label: 'Done',
    dot: 'bg-emerald-500',
  },
  failed: {
    bg: 'bg-[#1a0c0c]',
    border: 'border-red-500/30',
    glow: '',
    text: 'text-red-300',
    icon: <XCircle size={11} className="text-red-400" />,
    label: 'Failed',
    dot: 'bg-red-500',
  },
  skipped: {
    bg: 'bg-zinc-900/60',
    border: 'border-zinc-800',
    glow: '',
    text: 'text-zinc-600',
    icon: <Clock size={11} className="text-zinc-700" />,
    label: 'Skipped',
    dot: 'bg-zinc-700',
  },
};

const TYPE_ICON = {
  tool: <Wrench size={10} />,
  reasoning: <BrainCircuit size={10} />,
  synthesis: <Sparkles size={10} />,
  search: <Search size={10} />,
};

// ─── CUSTOM NODE ─────────────────────────────────────────────────────────────
const TaskNode = ({ data }) => {
  const s = STATUS[data.status] || STATUS.pending;
  const typeIcon = TYPE_ICON[data.type] || TYPE_ICON.reasoning;

  return (
    <div
      className={`
        relative rounded-xl border px-3.5 py-2.5
        ${s.bg} ${s.border} ${s.glow}
        transition-all duration-500 ease-out
        backdrop-blur-sm
      `}
      style={{ width: NODE_WIDTH, minHeight: NODE_HEIGHT }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-1.5 !h-1.5 !bg-zinc-600 !border-none !min-w-0 !min-h-0"
      />

      {/* Top row: type badge + status */}
      <div className="flex items-center justify-between mb-1.5">
        <div className={`flex items-center gap-1 ${s.text} opacity-70`}>
          {typeIcon}
          <span className="text-[9px] font-semibold uppercase tracking-widest">
            {data.type}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
          {s.icon}
        </div>
      </div>

      {/* Title */}
      <p className={`text-[11px] font-semibold leading-snug ${s.text} line-clamp-2`}>
        {data.title}
      </p>

      {/* Subtitle / content preview */}
      {data.content && data.status === 'completed' && (
        <p className="text-[9px] text-zinc-600 mt-1 line-clamp-1 italic">
          {data.content}
        </p>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-1.5 !h-1.5 !bg-zinc-600 !border-none !min-w-0 !min-h-0"
      />
    </div>
  );
};

const nodeTypes = { task: TaskNode };

// ─── EDGE STYLING ────────────────────────────────────────────────────────────
function getEdgeStyle(sourceStatus) {
  if (sourceStatus === 'completed') {
    return {
      stroke: '#10b981',
      strokeWidth: 1.5,
      strokeOpacity: 0.5,
    };
  }
  if (sourceStatus === 'processing') {
    return {
      stroke: '#3b82f6',
      strokeWidth: 1.5,
      strokeOpacity: 0.6,
    };
  }
  return {
    stroke: '#27272a',
    strokeWidth: 1,
    strokeOpacity: 0.5,
  };
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
const TaskTreeVisualization = ({ steps = [] }) => {
  const planningMeta = useMemo(() => {
    const planning = [...steps].reverse().find(s => s.stepId === 'planning' && (s.dynamicBranchCount !== undefined || s.branchesPruned !== undefined));
    return {
      dynamicBranchCount: planning?.dynamicBranchCount,
      branchesPruned: planning?.branchesPruned,
    };
  }, [steps]);

  const { layoutedNodes, layoutedEdges } = useMemo(() => {
    if (!steps.length) return { layoutedNodes: [], layoutedEdges: [] };

    // Build a lookup for status
    const statusMap = {};
    steps.forEach((s) => (statusMap[s.stepId] = s.status));

    // Build React Flow nodes
    const rawNodes = steps.map((step) => ({
      id: step.stepId,
      type: 'task',
      data: {
        title: step.title || step.stepId,
        status: step.status || 'pending',
        type: step.type || 'reasoning',
        content: step.content,
      },
      position: { x: 0, y: 0 }, // will be overwritten by dagre
    }));

    // Build React Flow edges
    const rawEdges = [];
    steps.forEach((step) => {
      if (step.dependencies && step.dependencies.length > 0) {
        step.dependencies.forEach((depId) => {
          const sourceStatus = statusMap[depId] || 'pending';
          rawEdges.push({
            id: `e-${depId}-${step.stepId}`,
            source: depId,
            target: step.stepId,
            type: 'smoothstep',
            animated: sourceStatus === 'processing',
            style: getEdgeStyle(sourceStatus),
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 12,
              height: 12,
              color: sourceStatus === 'completed' ? '#10b981' : '#3f3f46',
            },
          });
        });
      }
    });

    const { nodes: ln, edges: le } = getLayoutedElements(rawNodes, rawEdges);
    return { layoutedNodes: ln, layoutedEdges: le };
  }, [steps]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  // Keep nodes/edges in sync when steps update
  React.useEffect(() => {
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges]);

  if (!steps.length) return null;

  return (
    <div
      className="w-full rounded-2xl border border-white/[0.04] overflow-hidden relative"
      style={{ height: Math.max(280, layoutedNodes.length * 70 + 120) }}
    >
      {/* Header badge */}
      <div className="absolute top-3 left-3 z-10 pointer-events-none">
        <div className="flex items-center gap-1.5 bg-zinc-900/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/[0.06]">
          <Sparkles size={12} className="text-blue-400" />
          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.15em]">
            Task Graph
          </span>
          {Number.isFinite(planningMeta.dynamicBranchCount) && (
            <span className="text-[9px] text-zinc-300 border-l border-zinc-700 pl-1.5">
              Branches {planningMeta.dynamicBranchCount}
            </span>
          )}
          {Number.isFinite(planningMeta.branchesPruned) && (
            <span className="text-[9px] text-zinc-300">
              · Pruned {planningMeta.branchesPruned}
            </span>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="absolute top-3 right-3 z-10 pointer-events-none">
        <div className="flex items-center gap-3 bg-zinc-900/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/[0.06]">
          {['pending', 'processing', 'completed', 'failed'].map((key) => (
            <div key={key} className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS[key].dot}`} />
              <span className="text-[8px] text-zinc-500 capitalize">{STATUS[key].label}</span>
            </div>
          ))}
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.4}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#18181b" gap={24} size={0.5} />
      </ReactFlow>
    </div>
  );
};

export default TaskTreeVisualization;
