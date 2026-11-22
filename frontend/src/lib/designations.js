// Job titles offered in the Designation dropdown. A designation is what the
// person DOES (Cashier, Baker…); their app ROLE (Admin/Accountant/Staff) is a
// separate permission set in Settings → Users.

const COMMON = ['Manager', 'Assistant Manager', 'Supervisor', 'Accountant', 'Cashier', 'Sales Executive', 'Storekeeper', 'Office Assistant', 'Driver', 'Security Guard', 'Cleaner', 'Helper', 'Intern'];

const BY_TYPE = {
  FOOD_BEVERAGE: ['Manager', 'Supervisor', 'Cashier', 'Chef', 'Cook', 'Baker', 'Barista', 'Waiter', 'Kitchen Helper', 'Dishwasher', 'Delivery Rider', 'Accountant', 'Cleaner'],
  PHARMACY: ['Pharmacist', 'Assistant Pharmacist', 'Cashier', 'Storekeeper', 'Delivery Rider', 'Accountant', 'Manager'],
  RETAIL: ['Store Manager', 'Sales Executive', 'Cashier', 'Storekeeper', 'Helper', 'Delivery Rider', 'Accountant'],
  ELECTRONICS: ['Store Manager', 'Sales Executive', 'Technician', 'Cashier', 'Storekeeper', 'Delivery Rider', 'Accountant'],
  SERVICES: ['Manager', 'Consultant', 'Technician', 'Customer Support', 'Office Assistant', 'Accountant', 'Driver'],
  MANUFACTURING: ['Plant Manager', 'Supervisor', 'Machine Operator', 'Technician', 'Quality Inspector', 'Storekeeper', 'Helper', 'Driver', 'Accountant'],
  SCHOOL: ['Principal', 'Vice Principal', 'Coordinator', 'Teacher', 'Accountant', 'Librarian', 'Lab Assistant', 'Hostel Warden', 'Office Assistant', 'Driver', 'Security Guard', 'Cleaner', 'Peon'],
};

// Presets for the company's type, then titles already used in the company,
// then the current value — no duplicates (any case), in that order.
export function designationOptions(businessType, existing = [], current = '') {
  const out = [];
  const seen = new Set();
  for (const d of [...(BY_TYPE[businessType] || COMMON), ...existing, current]) {
    const v = String(d || '').trim();
    if (v && !seen.has(v.toLowerCase())) { seen.add(v.toLowerCase()); out.push(v); }
  }
  return out;
}
