const fs = require('fs');
const path = require('path');

const ROOT_BOOTSTRAP_DIR = path.join(__dirname, '..', '..', 'course_bootstrap');
const SERVER_BOOTSTRAP_DIR = path.join(__dirname, '..', 'course_bootstrap');
const INVENTORY_PATHS = [
  path.join(__dirname, '..', '..', 'curriculum_reports', 'curriculum_inventory.json'),
];

let cachedTitleMap = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

function getBootstrapDirs() {
  return [SERVER_BOOTSTRAP_DIR, ROOT_BOOTSTRAP_DIR].filter(dir => fs.existsSync(dir));
}

function readCourseNameFromSyllabusCsv(code, bootstrapDir = ROOT_BOOTSTRAP_DIR) {
  try {
    const csvPath = path.join(bootstrapDir, code, 'syllabus.csv');
    if (!fs.existsSync(csvPath)) return null;
    const firstDataLine = fs.readFileSync(csvPath, 'utf8').split('\n')[1];
    if (!firstDataLine) return null;
    const match = firstDataLine.match(/^(?:[^,]*,\s*)?([^,]+)/);
    if (!match) return null;
    const name = match[1].trim().replace(/^"|"$/g, '');
    return name && name !== code ? name : null;
  } catch {
    return null;
  }
}

function buildCourseTitleMap() {
  const now = Date.now();
  if (cachedTitleMap && (now - cachedAt) < CACHE_TTL_MS) {
    return cachedTitleMap;
  }

  const map = {};

  try {
    for (const bootstrapDir of getBootstrapDirs()) {
      const entries = fs.readdirSync(bootstrapDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
        const code = entry.name.trim();
        if (!code || map[code.toLowerCase()]) continue;
        const title = readCourseNameFromSyllabusCsv(code, bootstrapDir);
        if (title) map[code.toLowerCase()] = title;
      }
    }
  } catch {
    // ignore
  }

  for (const inventoryPath of INVENTORY_PATHS) {
    try {
      if (!fs.existsSync(inventoryPath)) continue;
      const raw = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
      const courses = Array.isArray(raw.courses) ? raw.courses : [];
      for (const course of courses) {
        const code = String(course.courseName || course.code || course.courseCode || '').trim();
        const name = String(course.name || course.title || course.courseTitle || '').trim();
        if (!code || !name || map[code.toLowerCase()]) continue;
        map[code.toLowerCase()] = name;
      }
    } catch {
      // ignore
    }
  }

  cachedTitleMap = map;
  cachedAt = now;
  return map;
}

function resolveCourseTitle(courseOrTitle, fallback = '') {
  const raw = String(courseOrTitle || '').trim();
  if (!raw) return String(fallback || '').trim();
  if (raw.includes(' ') && !/^[A-Z]{2,}\d{2,}/i.test(raw)) {
    return raw;
  }

  const map = buildCourseTitleMap();
  const title = map[raw.toLowerCase()];
  if (title) return title;

  return String(fallback || raw).trim();
}

module.exports = {
  buildCourseTitleMap,
  resolveCourseTitle,
};
