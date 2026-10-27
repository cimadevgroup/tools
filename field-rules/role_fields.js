/* role_fields.js — mapa rol × campo (fuente única: tools/field-rules).
 * Navegador: window.RoleFields. Node/CommonJS: module.exports.
 * Servidores (ES modules): sync.sh genera role_fields.mjs con `export default`.
 *
 *   RoleFields.applies(role, field) → bool   (rol desconocido → true: no esconder de más)
 *   RoleFields.titles(role) → []
 *   RoleFields.label(role) → 'Médico' | 'Residente' | 'Enfermería' | 'Asistente' | 'Recepción' | 'Administración' | 'Dueño'
 */
(function (root) {
  'use strict';

  const GROUP = { doctor: 'clin', owner: 'clin', resident: 'res', nurse: 'nur',
                  assistant: 'sup', receptionist: 'sup', admin: 'adm' };

  // campo → grupos donde APLICA (si no está: aplica a todos)
  const FIELDS = {
    work_for: ['res', 'nur', 'sup', 'adm'],
    instagram: ['clin', 'res'],   office: ['clin', 'res'],
    specialty: ['clin', 'res'],   subspecialty: ['clin', 'res'],
    institution: ['clin', 'res', 'nur'], service_name: ['clin', 'res', 'nur'],
    government_license: ['clin', 'res', 'nur'], prof_assoc_license: ['clin', 'res', 'nur'],
    services: ['clin'], currencies: ['clin'], default_duration: ['clin'], payment_methods: ['clin'],
    pref_model: ['clin', 'res'],  signature: ['clin', 'res'], stamp: ['clin', 'res'], templates: ['clin']
    // blood_type no está en la lista: aplica a todos (decisión de Miguel)
  };

  const TITLES = { clin: ['Dr.', 'Dra.'], res: ['Dr.', 'Dra.'], nur: ['Lic.', 'Enf.', 'Sr.', 'Sra.'],
                   sup: ['Lic.', 'Sr.', 'Sra.', 'Srta.'], adm: ['Lic.', 'Ing.', 'Sr.', 'Sra.'] };

  const LABELS = { doctor: 'Médico', resident: 'Residente', nurse: 'Enfermería', assistant: 'Asistente',
                   receptionist: 'Recepción', admin: 'Administración', owner: 'Dueño' };

  function applies(role, field) {
    const g = GROUP[role];
    if (!g) return true;
    const list = FIELDS[field];
    return !list || list.indexOf(g) >= 0;
  }
  function titles(role) {
    const g = GROUP[role];
    return g ? TITLES[g].slice() : [];
  }
  function label(role) {
    return LABELS[role] || '';
  }

  const RF = { GROUP, FIELDS, TITLES, LABELS, ROLES: Object.keys(LABELS), applies, titles, label };
  if (typeof module === 'object' && module && module.exports) module.exports = RF;
  root.RoleFields = RF;
})(typeof globalThis !== 'undefined' ? globalThis : this);
