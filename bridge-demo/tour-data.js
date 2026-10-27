// Positions are in the ground-aligned coordinate system of scene.json.
// These are prototype observation points, not a measured floor plan.
export const sceneTransform = {
  position: [0, 1.6626182794570923, 0],
  rotation: [180, 0, 0],
  scale: 0.6557941436767578
};

export const waypoints = [
  { id: 'origin', label: 'Origin', position: [0, 1.6626, 0], yaw: -48, pitch: -8 },
  { id: 'windows', label: 'Window View', position: [-0.25, 1.6626, -0.28], yaw: -65, pitch: 1 },
  { id: 'equipment', label: 'Equipment', position: [0.12, 1.6626, 0.18], yaw: -45, pitch: -18 },
  { id: 'structure', label: 'Framework', position: [-0.15, 1.6626, 0.2], yaw: -48, pitch: 34 }
];

export const hotspots = [
  {
    id: 'equipment', number: '01', title: 'Equipment and Work Area', kicker: 'DETAIL / EQUIPMENT',
    position: [0.45, 1.1, -1.0], waypoint: 'equipment',
    body: 'Large equipment, seating, and work surfaces shape this working area. Move your view to notice their spacing and arrangement.',
    observation: 'Observe the equipment’s visible form and surface details. Names and specific uses remain to be confirmed.'
  },
  {
    id: 'windows', number: '02', title: 'Windows and Outside View', kicker: 'SPACE / WINDOWS',
    position: [1.5, 1.8, -1.3], waypoint: 'windows',
    body: 'The row of windows opens a view from inside toward the exterior. Their framing, glass, and metal wall create a clear visual rhythm.',
    observation: 'Notice the frames, sills, and changes in light between inside and outside.'
  },
  {
    id: 'structure', number: '03', title: 'Metal Framework', kicker: 'STRUCTURE / FRAMEWORK',
    position: [0.6, 2.45, -1.8], waypoint: 'structure',
    body: 'Look up to see repeating metal beams and fastening details. Curved lines and surface wear shape the character of the space.',
    observation: 'Follow the beams to observe how the overhead structure meets the surrounding walls.'
  }
];

export const navigation = {
  eyeHeight: 1.6626,
  // A deliberately conservative prototype boundary around the capture point.
  // The notch keeps navigation away from the dense central-device region.
  polygon: [[-0.55,-0.45],[-0.15,-0.45],[-0.02,-0.25],[0.28,-0.15],[0.28,0.5],[-0.55,0.5]],
  speed: 0.45
};

export const issueKinds = {
  geometry: 'Shape or missing surface', artifact: 'Floating artifact', navigation: 'Movement boundary', content: 'Content or label'
};
