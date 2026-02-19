import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

export interface DataLineageNode {
  id: string;
  name: string;
  type: 'source' | 'transformation' | 'target' | 'process';
  description: string;
  system: string;
  table?: string;
  column?: string;
  metadata: any;
  createdAt: Date;
}

export interface DataLineageEdge {
  id: string;
  sourceId: string;
  targetId: string;
  transformation?: string;
  description: string;
  timestamp: Date;
  metadata: any;
}

export interface DataLineageGraph {
  id: string;
  name: string;
  description: string;
  nodes: DataLineageNode[];
  edges: DataLineageEdge[];
  createdAt: Date;
  updatedAt: Date;
}

export interface LineageTrace {
  id: string;
  nodeId: string;
  traceType: 'upstream' | 'downstream' | 'complete';
  path: LineagePath[];
  createdAt: Date;
}

export interface LineagePath {
  fromNode: string;
  toNode: string;
  transformation: string;
  timestamp: Date;
}

export interface ImpactAnalysis {
  id: string;
  nodeId: string;
  affectedNodes: string[];
  impactLevel: 'high' | 'medium' | 'low';
  analysis: string;
  timestamp: Date;
}

@Injectable()
export class DataLineageService {
  private readonly logger = new Logger(DataLineageService.name);
  private graphs: Map<string, DataLineageGraph> = new Map();
  private traces: Map<string, LineageTrace> = new Map();
  private impactAnalyses: Map<string, ImpactAnalysis> = new Map();

  /**
   * Create a new lineage graph
   */
  async createGraph(graphConfig: Omit<DataLineageGraph, 'id' | 'createdAt' | 'updatedAt' | 'nodes' | 'edges'>): Promise<DataLineageGraph> {
    const graphId = uuidv4();
    const graph: DataLineageGraph = {
      id: graphId,
      ...graphConfig,
      nodes: [],
      edges: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.graphs.set(graphId, graph);
    this.logger.log(`Created lineage graph ${graphId}: ${graph.name}`);

    return graph;
  }

  /**
   * Get a lineage graph
   */
  async getGraph(graphId: string): Promise<DataLineageGraph | null> {
    return this.graphs.get(graphId) || null;
  }

  /**
   * Get all lineage graphs
   */
  async getAllGraphs(): Promise<DataLineageGraph[]> {
    return Array.from(this.graphs.values());
  }

  /**
   * Add a node to a lineage graph
   */
  async addNode(graphId: string, nodeConfig: Omit<DataLineageNode, 'id' | 'createdAt'>): Promise<DataLineageNode> {
    const graph = this.graphs.get(graphId);
    if (!graph) {
      throw new Error(`Graph ${graphId} not found`);
    }

    const node: DataLineageNode = {
      id: uuidv4(),
      ...nodeConfig,
      createdAt: new Date(),
    };

    graph.nodes.push(node);
    graph.updatedAt = new Date();

    this.logger.log(`Added node ${node.id} to graph ${graphId}`);

    return node;
  }

  /**
   * Add an edge to a lineage graph
   */
  async addEdge(graphId: string, edgeConfig: Omit<DataLineageEdge, 'id' | 'timestamp'>): Promise<DataLineageEdge> {
    const graph = this.graphs.get(graphId);
    if (!graph) {
      throw new Error(`Graph ${graphId} not found`);
    }

    // Validate that source and target nodes exist
    const sourceExists = graph.nodes.some(node => node.id === edgeConfig.sourceId);
    const targetExists = graph.nodes.some(node => node.id === edgeConfig.targetId);
    
    if (!sourceExists || !targetExists) {
      throw new Error('Source or target node not found in graph');
    }

    const edge: DataLineageEdge = {
      id: uuidv4(),
      ...edgeConfig,
      timestamp: new Date(),
    };

    graph.edges.push(edge);
    graph.updatedAt = new Date();

    this.logger.log(`Added edge ${edge.id} to graph ${graphId}`);

    return edge;
  }

  /**
   * Trace data lineage upstream or downstream
   */
  async traceLineage(
    graphId: string,
    nodeId: string,
    traceType: 'upstream' | 'downstream' | 'complete' = 'complete'
  ): Promise<LineageTrace> {
    const graph = this.graphs.get(graphId);
    if (!graph) {
      throw new Error(`Graph ${graphId} not found`);
    }

    const traceId = uuidv4();
    const path: LineagePath[] = [];

    if (traceType === 'upstream' || traceType === 'complete') {
      this.traceUpstream(graph, nodeId, path);
    }

    if (traceType === 'downstream' || traceType === 'complete') {
      this.traceDownstream(graph, nodeId, path);
    }

    const trace: LineageTrace = {
      id: traceId,
      nodeId,
      traceType,
      path,
      createdAt: new Date(),
    };

    this.traces.set(traceId, trace);
    this.logger.log(`Created lineage trace ${traceId} for node ${nodeId}`);

    return trace;
  }

  /**
   * Perform impact analysis
   */
  async analyzeImpact(graphId: string, nodeId: string): Promise<ImpactAnalysis> {
    const graph = this.graphs.get(graphId);
    if (!graph) {
      throw new Error(`Graph ${graphId} not found`);
    }

    const analysisId = uuidv4();
    const affectedNodes = this.findAffectedNodes(graph, nodeId);
    const impactLevel = this.calculateImpactLevel(affectedNodes.length, graph.nodes.length);

    const analysis: ImpactAnalysis = {
      id: analysisId,
      nodeId,
      affectedNodes,
      impactLevel,
      analysis: `Node ${nodeId} affects ${affectedNodes.length} other nodes`,
      timestamp: new Date(),
    };

    this.impactAnalyses.set(analysisId, analysis);
    this.logger.log(`Created impact analysis ${analysisId} for node ${nodeId}`);

    return analysis;
  }

  /**
   * Get lineage trace
   */
  async getTrace(traceId: string): Promise<LineageTrace | null> {
    return this.traces.get(traceId) || null;
  }

  /**
   * Get impact analysis
   */
  async getImpactAnalysis(analysisId: string): Promise<ImpactAnalysis | null> {
    return this.impactAnalyses.get(analysisId) || null;
  }

  /**
   * Get all traces for a graph
   */
  async getTracesForGraph(graphId: string): Promise<LineageTrace[]> {
    const traces = Array.from(this.traces.values());
    return traces.filter(trace => {
      const graph = this.graphs.get(graphId);
      return graph && graph.nodes.some(node => node.id === trace.nodeId);
    });
  }

  /**
   * Get all impact analyses for a graph
   */
  async getImpactAnalysesForGraph(graphId: string): Promise<ImpactAnalysis[]> {
    const analyses = Array.from(this.impactAnalyses.values());
    return analyses.filter(analysis => {
      const graph = this.graphs.get(graphId);
      return graph && graph.nodes.some(node => node.id === analysis.nodeId);
    });
  }

  /**
   * Create standard lineage for common data flows
   */
  async createStandardLineage(): Promise<DataLineageGraph> {
    const graph = await this.createGraph({
      name: 'Standard Data Flow',
      description: 'Standard lineage for user and post data flow',
    });

    // Add source nodes
    const userSource = await this.addNode(graph.id, {
      name: 'User Source System',
      type: 'source',
      description: 'Source system containing user data',
      system: 'User Service',
      metadata: { systemType: 'microservice' },
    });

    const postSource = await this.addNode(graph.id, {
      name: 'Post Source System',
      type: 'source',
      description: 'Source system containing post data',
      system: 'Post Service',
      metadata: { systemType: 'microservice' },
    });

    // Add transformation nodes
    const userTransform = await this.addNode(graph.id, {
      name: 'User Data Transformation',
      type: 'transformation',
      description: 'ETL transformation for user data',
      system: 'ETL Pipeline',
      metadata: { transformationType: 'cleanse_enrich' },
    });

    const postTransform = await this.addNode(graph.id, {
      name: 'Post Data Transformation',
      type: 'transformation',
      description: 'ETL transformation for post data',
      system: 'ETL Pipeline',
      metadata: { transformationType: 'cleanse_enrich' },
    });

    // Add target nodes
    const dataWarehouse = await this.addNode(graph.id, {
      name: 'Data Warehouse',
      type: 'target',
      description: 'Central data warehouse',
      system: 'Snowflake',
      table: 'dim_users',
      metadata: { schema: 'analytics' },
    });

    const postWarehouse = await this.addNode(graph.id, {
      name: 'Post Data Warehouse',
      type: 'target',
      description: 'Post data in warehouse',
      system: 'Snowflake',
      table: 'fact_posts',
      metadata: { schema: 'analytics' },
    });

    // Add edges
    await this.addEdge(graph.id, {
      sourceId: userSource.id,
      targetId: userTransform.id,
      description: 'User data extraction',
      transformation: 'extract',
      metadata: { frequency: 'hourly' },
    });

    await this.addEdge(graph.id, {
      sourceId: postSource.id,
      targetId: postTransform.id,
      description: 'Post data extraction',
      transformation: 'extract',
      metadata: { frequency: 'hourly' },
    });

    await this.addEdge(graph.id, {
      sourceId: userTransform.id,
      targetId: dataWarehouse.id,
      description: 'Load transformed user data',
      transformation: 'load',
      metadata: { method: 'incremental' },
    });

    await this.addEdge(graph.id, {
      sourceId: postTransform.id,
      targetId: postWarehouse.id,
      description: 'Load transformed post data',
      transformation: 'load',
      metadata: { method: 'incremental' },
    });

    return graph;
  }

  /**
   * Search for nodes in lineage graphs
   */
  async searchNodes(
    searchTerm: string,
    graphId?: string
  ): Promise<DataLineageNode[]> {
    let nodes: DataLineageNode[] = [];

    if (graphId) {
      const graph = this.graphs.get(graphId);
      if (graph) {
        nodes = graph.nodes;
      }
    } else {
      // Search across all graphs
      for (const graph of this.graphs.values()) {
        nodes.push(...graph.nodes);
      }
    }

    // Filter by search term
    return nodes.filter(node => 
      node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.system.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  // Helper methods
  private traceUpstream(graph: DataLineageGraph, nodeId: string, path: LineagePath[]): void {
    const incomingEdges = graph.edges.filter(edge => edge.targetId === nodeId);
    
    for (const edge of incomingEdges) {
      path.push({
        fromNode: edge.sourceId,
        toNode: edge.targetId,
        transformation: edge.transformation || '',
        timestamp: edge.timestamp,
      });
      
      this.traceUpstream(graph, edge.sourceId, path);
    }
  }

  private traceDownstream(graph: DataLineageGraph, nodeId: string, path: LineagePath[]): void {
    const outgoingEdges = graph.edges.filter(edge => edge.sourceId === nodeId);
    
    for (const edge of outgoingEdges) {
      path.push({
        fromNode: edge.sourceId,
        toNode: edge.targetId,
        transformation: edge.transformation || '',
        timestamp: edge.timestamp,
      });
      
      this.traceDownstream(graph, edge.targetId, path);
    }
  }

  private findAffectedNodes(graph: DataLineageGraph, nodeId: string): string[] {
    const affectedNodes: string[] = [];
    const visited = new Set<string>();

    const traverse = (currentNodeId: string) => {
      if (visited.has(currentNodeId)) return;
      visited.add(currentNodeId);

      const outgoingEdges = graph.edges.filter(edge => edge.sourceId === currentNodeId);
      for (const edge of outgoingEdges) {
        if (!affectedNodes.includes(edge.targetId)) {
          affectedNodes.push(edge.targetId);
        }
        traverse(edge.targetId);
      }
    };

    traverse(nodeId);
    return affectedNodes;
  }

  private calculateImpactLevel(affectedCount: number, totalCount: number): 'high' | 'medium' | 'low' {
    const percentage = (affectedCount / totalCount) * 100;
    
    if (percentage >= 50) return 'high';
    if (percentage >= 20) return 'medium';
    return 'low';
  }
}