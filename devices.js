'use strict';

// One catalog for names, addresses, and the paths the proxy may forward.
// The UI polls `reads`, which is this GET list, so it cannot drift from the allowlist.

const SHARED_GET = ['', 'mode', 'firmware', 'wifi', 'time'];
const SHARED_POST = ['mode'];

const catalog = {
  lights: {
    ip: '172.16.0.21',
    name: 'Reef Lights',
    icon: '💡',
    model: 'RSLED60',
    allow: {
      GET: [...SHARED_GET, 'lights', 'moonphase', 'acclimation', 'timer'],
      POST: [...SHARED_POST, 'manual', 'timer', 'moonphase', 'acclimation'],
      DELETE: ['moonphase', 'acclimation'],
    },
  },
  wave: {
    ip: '172.16.0.19',
    name: 'Reef Wave',
    icon: '🌊',
    model: 'RSWAVE25',
    allow: {
      GET: [...SHARED_GET],
      POST: [...SHARED_POST],
    },
  },
  ato: {
    ip: '172.16.0.20',
    name: 'Reef ATO+',
    icon: '💧',
    model: 'RSATO+',
    allow: {
      GET: [...SHARED_GET],
      POST: [...SHARED_POST],
    },
  },
};

function isAllowed(deviceKey, method, endpoint) {
  const paths = catalog[deviceKey]?.allow?.[method];
  return Array.isArray(paths) && paths.includes(endpoint);
}

function publicCatalog() {
  const body = {};
  for (const [key, device] of Object.entries(catalog)) {
    body[key] = {
      name: device.name,
      icon: device.icon,
      model: device.model,
      ip: device.ip,
      reads: device.allow.GET.slice(),
    };
  }
  return body;
}

module.exports = { catalog, isAllowed, publicCatalog };
