import type { DepartmentOut } from "../api/types";

/**
 * Prüft, ob ein Nutzer (über seine Organisationseinheit) für eine Raum- oder Zonen-Zuordnung
 * berechtigt ist.
 *
 * Regeln:
 * 1. Facility Manager (`isFm === true`) sind immer berechtigt.
 * 2. Räume/Zonen ohne Einschränkung (`!allowedDeptIds?.length && !allowedDeptNames?.length`) sind für alle frei.
 * 3. Wenn `allowedDeptIds` den `userDeptId` enthält -> berechtigt (Backend schlüsselt bei include_descendants
 *    bereits alle Untereinheiten auf).
 * 4. Fallback-Hierarchieprüfung: Der Vorfahren-Pfad des Nutzers (`parent_id`) wird bis zur Wurzel geprüft.
 *    Befindet sich eine der übergeordneten Einheiten in den erlaubten Einheiten, ist der Zugriff gestattet.
 */
export function isDeptAuthorized(
  userDeptId: number | null | undefined,
  userDeptName: string | null | undefined,
  allowedDeptIds: number[] | undefined,
  allowedDeptNames: string[] | undefined,
  departments: DepartmentOut[],
  isFm: boolean = false
): boolean {
  if (isFm) return true;

  const hasIds = Boolean(allowedDeptIds && allowedDeptIds.length > 0);
  const hasNames = Boolean(allowedDeptNames && allowedDeptNames.length > 0);
  if (!hasIds && !hasNames) return true;

  // Wenn keine Nutzer-Org bekannt ist, kann nicht zugeordnet werden
  let effectiveDeptId = userDeptId;
  if (!effectiveDeptId && userDeptName) {
    const match = departments.find(
      (d) =>
        d.name.toLowerCase() === userDeptName.toLowerCase() ||
        d.code.toLowerCase() === userDeptName.toLowerCase()
    );
    if (match) effectiveDeptId = match.id;
  }

  if (!effectiveDeptId) return false;

  // Erlaubte IDs sammeln
  const allowedSet = new Set<number>(allowedDeptIds || []);
  if (hasNames && allowedDeptNames) {
    for (const d of departments) {
      if (
        allowedDeptNames.some(
          (name) =>
            name.toLowerCase() === d.name.toLowerCase() ||
            name.toLowerCase() === d.code.toLowerCase()
        )
      ) {
        allowedSet.add(d.id);
      }
    }
  }

  // Direkter Treffer
  if (allowedSet.has(effectiveDeptId)) return true;

  // Vorfahren-Kette (parent_id) prüfen
  const deptMap = new Map<number, DepartmentOut>();
  for (const d of departments) {
    deptMap.set(d.id, d);
  }

  let curId: number | null | undefined = effectiveDeptId;
  const seen = new Set<number>();
  while (curId && !seen.has(curId)) {
    seen.add(curId);
    if (allowedSet.has(curId)) return true;
    curId = deptMap.get(curId)?.parent_id;
  }

  return false;
}
