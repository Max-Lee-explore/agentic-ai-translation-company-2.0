/** HD-2D plate world (Option A). Y is depth — larger Y is closer to camera. */

export const WORLD = { w: 960, h: 540 };

/** Glass offices along the back wall. */
export const ROOMS = {
  manager: { x: 332, y: 72, w: 148, h: 206, doorX: 50, doorW: 48, label: 'Manager', color: '#c8643b' },
  editor: { x: 480, y: 72, w: 148, h: 206, doorX: 50, doorW: 48, label: 'Editor', color: '#6e9a74' },
  master: { x: 628, y: 72, w: 168, h: 206, doorX: 56, doorW: 48, label: 'Master', color: '#6b4a33' },
};

export const CLUSTERS = {
  creative: { x: 40, y: 312, w: 210, h: 188, rug: '#e8b4c8', label: 'Creative' },
  legal_business: { x: 252, y: 312, w: 214, h: 188, rug: '#a8c0d8', label: 'Legal' },
  science_medical: { x: 468, y: 312, w: 214, h: 188, rug: '#b8d4a8', label: 'Science' },
  news_media: { x: 684, y: 312, w: 230, h: 188, rug: '#e8c878', label: 'News' },
};

/**
 * Feet on the floor. Behind a desk = Y smaller than the desk slice sortY.
 * Inside a glass room = Y above the hall (smaller than the room front).
 * Door is the left-wall glass entrance.
 */
export const SEATS = {
  manager: { x: 404, y: 242 },
  manager_guest: { x: 404, y: 296 },
  editor: { x: 552, y: 242 },
  master: { x: 710, y: 242 },
  'creative-1': { x: 158, y: 342 },
  'creative-2': { x: 148, y: 452 },
  'legal-1': { x: 370, y: 342 },
  'legal-2': { x: 360, y: 452 },
  'science-1': { x: 564, y: 342 },
  'science-2': { x: 576, y: 452 },
  'news-1': { x: 764, y: 342 },
  'news-2': { x: 786, y: 452 },
  terminologist: { x: 868, y: 252 },
  reception: { x: 168, y: 226 },
  chunkomatic: { x: 218, y: 252 },
  bind: { x: 868, y: 272 },
  door: { x: 86, y: 258 },
  door_wait: { x: 128, y: 278 },
};

export const PROPS = {
  chunkomatic: { x: 178, y: 140, w: 88, h: 96 },
  bindStation: { x: 804, y: 158, w: 140, h: 112 },
  door: { x: 18, y: 78, w: 118, h: 186 },
  termDesk: { x: 804, y: 158, w: 80, h: 44 },
  receptionDesk: { x: 102, y: 168, w: 168, h: 86 },
};

/**
 * Plate slices redrawn on top of actors with smaller Y so people can
 * stand behind desks. Coordinates match the Option A painting at 960×540.
 */
export const FURNITURE = [
  { id: 'printer', kind: 'plate-slice', x: 178, y: 140, w: 86, h: 96, sortY: 234, glowX: 222, glowY: 168 },
  { id: 'vending', kind: 'plate-slice', x: 252, y: 138, w: 70, h: 108, sortY: 244 },
  { id: 'reception', kind: 'plate-slice', x: 102, y: 172, w: 160, h: 82, sortY: 252 },
  { id: 'bind', kind: 'plate-slice', x: 808, y: 158, w: 136, h: 108, sortY: 266, glowX: 868, glowY: 190 },
  { id: 'side-table', kind: 'plate-slice', x: 2, y: 308, w: 88, h: 64, sortY: 370 },
  { id: 'desk-pink', kind: 'plate-slice', x: 88, y: 332, w: 142, h: 92, sortY: 420 },
  { id: 'desk-blue', kind: 'plate-slice', x: 298, y: 332, w: 148, h: 92, sortY: 420 },
  { id: 'desk-green', kind: 'plate-slice', x: 490, y: 332, w: 148, h: 92, sortY: 420 },
  { id: 'desk-yellow', kind: 'plate-slice', x: 686, y: 332, w: 158, h: 92, sortY: 420 },
  { id: 'parapet', kind: 'plate-slice', x: 0, y: 500, w: 960, h: 40, sortY: 540 },
];

export const HUBS = [
  { id: 'hall_door', x: 88, y: 268 },
  { id: 'hall_left', x: 188, y: 292 },
  { id: 'hall_mid', x: 480, y: 292 },
  { id: 'hall_rooms', x: 480, y: 278 },
  { id: 'hall_aisle', x: 480, y: 308 },
  { id: 'hall_front', x: 480, y: 472 },
  { id: 'hall_front_left', x: 148, y: 472 },
  { id: 'hall_front_right', x: 786, y: 472 },
  { id: 'hall_right', x: 840, y: 292 },
  { id: 'door_manager', x: 404, y: 296 },
  { id: 'door_editor', x: 552, y: 296 },
  { id: 'door_master', x: 710, y: 296 },
];

export const LIGHT = { x: 96, y: 80 };

export function seatOf(id) {
  return SEATS[id] || SEATS.door;
}
