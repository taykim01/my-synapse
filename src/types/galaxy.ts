export type NodeType = 'center' | 'keyword' | 'detailedKeyword' | 'capture';

export interface GalaxyNode {
  id: string;
  type: NodeType;
  label: string;
  title?: string;
  body?: string;
  tags?: string[];
  x: number;
  y: number;
  originX: number;
  originY: number;
  size: number;
  color: string;
  glowIntensity: number;
  captureCount?: number;
}

export interface Connection {
  id: string;
  from: string;
  to: string;
  strength: number;
}

export interface CaptureInput {
  title: string;
  body: string;
  tags: string[];
}
