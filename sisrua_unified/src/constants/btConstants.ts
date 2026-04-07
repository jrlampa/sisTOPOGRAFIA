import { BtTopology } from '../types';

export const EMPTY_BT_TOPOLOGY: BtTopology = {
  poles: [],
  transformers: [],
  edges: []
};

export const MAX_BT_EXPORT_HISTORY = 20;

export const NORMAL_CLIENT_RAMAL_TYPES = [
  '5 CC', '8 CC', '13 CC', '21 CC', '33 CC', '53 CC', '67 CC', '85 CC',
  '107 CC', '127 CC', '253 CC', '13 DX 6 AWG', '13 TX 6 AWG', '13 QX 6 AWG',
  '21 QX 4 AWG', '53 QX 1/0', '85 QX 3/0', '107 QX 4/0', '70 MMX', '185 MMX'
];

export const CLANDESTINO_RAMAL_TYPE = 'Clandestino';
export const DEFAULT_EDGE_CONDUCTOR = '70 Al - MX';

export type PendingNormalClassificationPole = {
  poleId: string;
  poleTitle: string;
  clandestinoClients: number;
};
