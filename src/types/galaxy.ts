export type NodeType = 'center' | 'keyword' | 'detailedKeyword' | 'capture';

export interface GalaxyNode {
  id: string;
  type: NodeType;
  label: string;
  title?: string;
  description?: string;
  content_type?: string;
  content_url?: string;
  source?: string;
  tags?: string[];
  connected_to?: string;
  x: number;
  y: number;
  originX: number;
  originY: number;
  size: number;
  color: string;
  glowIntensity: number;
  captureCount?: number;
}

export interface CaptureInput {
  title: string;
  description: string;
  content_type: string;
  content_url?: string;
  source?: string;
  tags: string[];
}
