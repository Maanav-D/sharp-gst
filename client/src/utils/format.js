/**
 * Format number in Indian numbering system with ₹ symbol
 * e.g. 1234567.89 → ₹12,34,567.89
 */
export function formatINR(num) {
  if (num === null || num === undefined || num === '') return '₹0.00';
  const n = Number(num);
  if (isNaN(n)) return '₹0.00';

  const parts = Math.abs(n).toFixed(2).split('.');
  let intPart = parts[0];
  const decPart = parts[1];

  if (intPart.length <= 3) {
    return (n < 0 ? '-' : '') + '₹' + intPart + '.' + decPart;
  }

  const last3 = intPart.slice(-3);
  let rest = intPart.slice(0, -3);
  let result = '';
  while (rest.length > 2) {
    result = ',' + rest.slice(-2) + result;
    rest = rest.slice(0, -2);
  }
  result = rest + result + ',' + last3;
  return (n < 0 ? '-' : '') + '₹' + result + '.' + decPart;
}

/**
 * Format date string to DD/MM/YYYY
 */
export function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Indian states with codes
 */
export const INDIAN_STATES = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '25', name: 'Daman & Diu' },
  { code: '26', name: 'Dadra & Nagar Haveli' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
];

export const STATUS_COLORS = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SENT: 'bg-blue-100 text-blue-700',
  PAID: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-200 text-gray-500 line-through',
};

export function getStateName(code) {
  const state = INDIAN_STATES.find(s => s.code === code);
  return state ? state.name : code;
}
