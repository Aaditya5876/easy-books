// A subject with no assigned standards is available everywhere (backward-compatible
// default for subjects created before standards existed, or intentionally general subjects).
export function filterSubjectsByClass(subjects, classId) {
  if (!classId) return subjects;
  return subjects.filter(s => !s.classes?.length || s.classes.some(sc => sc.classId === classId));
}
